use std::{net::SocketAddr, path::Path, sync::LazyLock};

use anyhow::Context;
use axum::{
    extract::{Path as AxumPath, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, FromRow, SqlitePool};
use tower_http::{services::ServeDir, trace::TraceLayer};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: SqlitePool,
}

#[derive(Debug, Deserialize)]
struct MatchupQuery {
    champion: Option<String>,
    opponent: Option<String>,
    lane: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
struct RuneMatchup {
    id: String,
    champion: String,
    opponent: String,
    lane: String,
    primary_tree: String,
    primary_runes: String,
    secondary_tree: String,
    secondary_runes: String,
    shards: String,
    notes: String,
    games_played: i64,
    wins: i64,
    confidence: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct RuneMatchupInput {
    champion: String,
    opponent: String,
    lane: String,
    primary_tree: String,
    primary_runes: String,
    secondary_tree: String,
    secondary_runes: String,
    shards: String,
    notes: Option<String>,
    games_played: Option<i64>,
    wins: Option<i64>,
    confidence: Option<i64>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("lol_rune_matchups=debug,tower_http=info")
        .init();

    let data_dir = Path::new("data");
    tokio::fs::create_dir_all(data_dir)
        .await
        .context("failed to create data directory")?;

    let db = SqlitePoolOptions::new()
        .max_connections(5)
        .connect("sqlite://data/runes.db?mode=rwc")
        .await
        .context("failed to open SQLite database")?;

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .context("failed to run database migrations")?;

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/enums", get(enums))
        .route("/api/matchups", get(list_matchups).post(create_matchup))
        .route(
            "/api/matchups/:id",
            get(get_matchup).put(update_matchup).delete(delete_matchup),
        )
        .nest_service("/", ServeDir::new("static").append_index_html_on_directories(true))
        .layer(TraceLayer::new_for_http())
        .with_state(AppState { db });

    let addr: SocketAddr = "127.0.0.1:8080".parse().unwrap();
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("LoL Rune Matchups running at http://{addr}");

    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

async fn enums() -> Json<serde_json::Value> {
    let trees: Vec<_> = RUNE_TREE_DATA
        .iter()
        .map(|t| {
            serde_json::json!({
                "name": t.name,
                "keystones": t.keystones,
                "slots": t.slots,
            })
        })
        .collect();

    Json(serde_json::json!({
        "champions": CHAMPIONS,
        "lanes": LANES,
        "runeTrees": trees,
        "shardSlots": SHARD_SLOTS,
        "shardPresets": *SHARD_PRESETS,
    }))
}

async fn list_matchups(
    State(state): State<AppState>,
    Query(query): Query<MatchupQuery>,
) -> Result<Json<Vec<RuneMatchup>>, AppError> {
    let champion = like_filter(query.champion);
    let opponent = like_filter(query.opponent);
    let lane = query.lane.unwrap_or_default();

    let rows = sqlx::query_as::<_, RuneMatchup>(
        r#"
        SELECT * FROM rune_matchups
        WHERE champion LIKE ?
          AND opponent LIKE ?
          AND (? = '' OR lane = ?)
        ORDER BY updated_at DESC, champion ASC, opponent ASC
        "#,
    )
    .bind(champion)
    .bind(opponent)
    .bind(&lane)
    .bind(&lane)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rows))
}

async fn get_matchup(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<Json<RuneMatchup>, AppError> {
    let row = sqlx::query_as::<_, RuneMatchup>("SELECT * FROM rune_matchups WHERE id = ?")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::not_found("matchup not found"))?;

    Ok(Json(row))
}

async fn create_matchup(
    State(state): State<AppState>,
    Json(input): Json<RuneMatchupInput>,
) -> Result<(StatusCode, Json<RuneMatchup>), AppError> {
    validate_input(&input)?;

    let id = Uuid::new_v4().to_string();
    insert_or_replace(&state.db, &id, input).await?;

    let created = sqlx::query_as::<_, RuneMatchup>("SELECT * FROM rune_matchups WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    Ok((StatusCode::CREATED, Json(created)))
}

async fn update_matchup(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
    Json(input): Json<RuneMatchupInput>,
) -> Result<Json<RuneMatchup>, AppError> {
    validate_input(&input)?;

    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM rune_matchups WHERE id = ?")
        .bind(&id)
        .fetch_optional(&state.db)
        .await?;

    if exists.is_none() {
        return Err(AppError::not_found("matchup not found"));
    }

    update_existing(&state.db, &id, input).await?;

    let updated = sqlx::query_as::<_, RuneMatchup>("SELECT * FROM rune_matchups WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    Ok(Json(updated))
}

async fn delete_matchup(
    State(state): State<AppState>,
    AxumPath(id): AxumPath<String>,
) -> Result<StatusCode, AppError> {
    let result = sqlx::query("DELETE FROM rune_matchups WHERE id = ?")
        .bind(id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::not_found("matchup not found"));
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn insert_or_replace(
    db: &SqlitePool,
    id: &str,
    input: RuneMatchupInput,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO rune_matchups (
            id, champion, opponent, lane, primary_tree, primary_runes,
            secondary_tree, secondary_runes, shards, notes, games_played,
            wins, confidence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            champion = excluded.champion,
            opponent = excluded.opponent,
            lane = excluded.lane,
            primary_tree = excluded.primary_tree,
            primary_runes = excluded.primary_runes,
            secondary_tree = excluded.secondary_tree,
            secondary_runes = excluded.secondary_runes,
            shards = excluded.shards,
            notes = excluded.notes,
            games_played = excluded.games_played,
            wins = excluded.wins,
            confidence = excluded.confidence
        "#,
    )
    .bind(id)
    .bind(normalize(&input.champion))
    .bind(normalize(&input.opponent))
    .bind(input.lane.trim())
    .bind(input.primary_tree.trim())
    .bind(input.primary_runes.trim())
    .bind(input.secondary_tree.trim())
    .bind(input.secondary_runes.trim())
    .bind(input.shards.trim())
    .bind(input.notes.unwrap_or_default().trim().to_string())
    .bind(input.games_played.unwrap_or(0).max(0))
    .bind(input.wins.unwrap_or(0).max(0))
    .bind(input.confidence.unwrap_or(3).clamp(1, 5))
    .execute(db)
    .await?;

    Ok(())
}

async fn update_existing(db: &SqlitePool, id: &str, input: RuneMatchupInput) -> Result<(), AppError> {
    sqlx::query(
        r#"
        UPDATE rune_matchups SET
            champion = ?,
            opponent = ?,
            lane = ?,
            primary_tree = ?,
            primary_runes = ?,
            secondary_tree = ?,
            secondary_runes = ?,
            shards = ?,
            notes = ?,
            games_played = ?,
            wins = ?,
            confidence = ?
        WHERE id = ?
        "#,
    )
    .bind(normalize(&input.champion))
    .bind(normalize(&input.opponent))
    .bind(input.lane.trim())
    .bind(input.primary_tree.trim())
    .bind(input.primary_runes.trim())
    .bind(input.secondary_tree.trim())
    .bind(input.secondary_runes.trim())
    .bind(input.shards.trim())
    .bind(input.notes.unwrap_or_default().trim().to_string())
    .bind(input.games_played.unwrap_or(0).max(0))
    .bind(input.wins.unwrap_or(0).max(0))
    .bind(input.confidence.unwrap_or(3).clamp(1, 5))
    .bind(id)
    .execute(db)
    .await?;

    Ok(())
}

fn validate_input(input: &RuneMatchupInput) -> Result<(), AppError> {
    let required = [
        ("champion", &input.champion),
        ("opponent", &input.opponent),
        ("lane", &input.lane),
        ("primary_tree", &input.primary_tree),
        ("primary_runes", &input.primary_runes),
        ("secondary_tree", &input.secondary_tree),
        ("secondary_runes", &input.secondary_runes),
        ("shards", &input.shards),
    ];

    if let Some((field, _)) = required.iter().find(|(_, value)| value.trim().is_empty()) {
        return Err(AppError::bad_request(format!("{field} is required")));
    }

    if input.wins.unwrap_or(0) > input.games_played.unwrap_or(0) {
        return Err(AppError::bad_request("wins cannot be greater than games_played"));
    }

    validate_enum("champion", &input.champion, CHAMPIONS)?;
    validate_enum("opponent", &input.opponent, CHAMPIONS)?;
    validate_enum("lane", &input.lane, LANES)?;
    let tree_refs: Vec<&str> = RUNE_TREES.iter().copied().collect();
    validate_enum("primary_tree", &input.primary_tree, &tree_refs)?;
    validate_enum("secondary_tree", &input.secondary_tree, &tree_refs)?;
    validate_runes("primary_runes", &input.primary_runes, &input.primary_tree, false)?;
    validate_runes(
        "secondary_runes",
        &input.secondary_runes,
        &input.secondary_tree,
        true,
    )?;
    let shard_refs: Vec<&str> = SHARD_PRESETS.iter().map(String::as_str).collect();
    validate_enum("shards", &input.shards, &shard_refs)?;

    Ok(())
}

fn validate_enum(field: &str, value: &str, allowed: &[&str]) -> Result<(), AppError> {
    if allowed.iter().any(|allowed_value| *allowed_value == value.trim()) {
        return Ok(());
    }

    Err(AppError::bad_request(format!("{field} has an invalid value")))
}

fn validate_runes(
    field: &str,
    value: &str,
    tree: &str,
    secondary_only: bool,
) -> Result<(), AppError> {
    let allowed = runes_for_tree(tree)
        .ok_or_else(|| AppError::bad_request(format!("{field} has an invalid tree")))?;
    let allowed = if secondary_only {
        &allowed[keystone_count(tree)..]
    } else {
        allowed
    };

    for rune in value.split(',').map(str::trim) {
        if rune.is_empty() || !allowed.iter().any(|allowed_value| *allowed_value == rune) {
            return Err(AppError::bad_request(format!("{field} has an invalid value")));
        }
    }

    Ok(())
}

struct TreeData {
    name: &'static str,
    keystones: &'static [&'static str],
    slots: [&'static [&'static str]; 3],
}

fn tree_data(tree: &str) -> Option<&'static TreeData> {
    RUNE_TREE_DATA.iter().find(|t| t.name == tree.trim())
}

fn keystone_count(tree: &str) -> usize {
    tree_data(tree).map(|t| t.keystones.len()).unwrap_or(0)
}

static TREE_FLAT_RUNES: LazyLock<Vec<(&'static str, Vec<&'static str>)>> = LazyLock::new(|| {
    RUNE_TREE_DATA
        .iter()
        .map(|t| {
            let mut all: Vec<&'static str> = t.keystones.to_vec();
            for slot in &t.slots {
                all.extend_from_slice(slot);
            }
            (t.name, all)
        })
        .collect()
});

fn runes_for_tree(tree: &str) -> Option<&'static [&'static str]> {
    TREE_FLAT_RUNES
        .iter()
        .find(|(name, _)| *name == tree.trim())
        .map(|(_, runes)| runes.as_slice())
}

const CHAMPIONS: &[&str] = &[
    "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia",
    "Annie", "Aphelios", "Ashe", "Aurelion Sol", "Aurora", "Azir", "Bard",
    "Bel'Veth", "Blitzcrank", "Brand", "Braum", "Briar", "Caitlyn", "Camille",
    "Cassiopeia", "Cho'Gath", "Corki", "Darius", "Diana", "Dr. Mundo", "Draven",
    "Ekko", "Elise", "Evelynn", "Ezreal", "Fiddlesticks", "Fiora", "Fizz",
    "Galio", "Gangplank", "Garen", "Gnar", "Gragas", "Graves", "Gwen", "Hecarim",
    "Heimerdinger", "Hwei", "Illaoi", "Irelia", "Ivern", "Janna", "Jarvan IV",
    "Jax", "Jayce", "Jhin", "Jinx", "K'Sante", "Kai'Sa", "Kalista", "Karma",
    "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen", "Kha'Zix",
    "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona", "Lillia",
    "Lissandra", "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai",
    "Master Yi", "Mel", "Milio", "Miss Fortune", "Mordekaiser", "Morgana",
    "Naafiri", "Nami", "Nasus", "Nautilus", "Neeko", "Nidalee", "Nilah",
    "Nocturne", "Nunu & Willump", "Olaf", "Orianna", "Ornn", "Pantheon", "Poppy",
    "Pyke", "Qiyana", "Quinn", "Rakan", "Rammus", "Rek'Sai", "Rell", "Renata Glasc",
    "Renekton", "Rengar", "Riven", "Rumble", "Ryze", "Samira", "Sejuani", "Senna",
    "Seraphine", "Sett", "Shaco", "Shen", "Shyvana", "Singed", "Sion", "Sivir",
    "Skarner", "Smolder", "Sona", "Soraka", "Swain", "Sylas", "Syndra", "Tahm Kench",
    "Taliyah", "Talon", "Taric", "Teemo", "Thresh", "Tristana", "Trundle",
    "Tryndamere", "Twisted Fate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne",
    "Veigar", "Vel'Koz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear",
    "Warwick", "Wukong", "Xayah", "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick",
    "Yunara", "Yuumi", "Zaahen", "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
];

const LANES: &[&str] = &["Top", "Jungle", "Mid", "Bot", "Support"];

static RUNE_TREES: LazyLock<Vec<&'static str>> =
    LazyLock::new(|| RUNE_TREE_DATA.iter().map(|t| t.name).collect());

const RUNE_TREE_DATA: &[TreeData] = &[
    TreeData {
        name: "Precision",
        keystones: &["Press the Attack", "Fleet Footwork", "Conqueror"],
        slots: [
            &["Absorb Life", "Triumph", "Presence of Mind"],
            &["Legend: Alacrity", "Legend: Haste", "Legend: Bloodline"],
            &["Coup de Grace", "Cut Down", "Last Stand"],
        ],
    },
    TreeData {
        name: "Domination",
        keystones: &["Electrocute", "Dark Harvest", "Hail of Blades"],
        slots: [
            &["Cheap Shot", "Taste of Blood", "Sudden Impact"],
            &["Sixth Sense", "Grisly Mementos", "Deep Ward"],
            &["Treasure Hunter", "Relentless Hunter", "Ultimate Hunter"],
        ],
    },
    TreeData {
        name: "Sorcery",
        keystones: &["Summon Aery", "Arcane Comet", "Phase Rush"],
        slots: [
            &["Nullifying Orb", "Manaflow Band", "Nimbus Cloak"],
            &["Transcendence", "Celerity", "Absolute Focus"],
            &["Scorch", "Waterwalking", "Gathering Storm"],
        ],
    },
    TreeData {
        name: "Resolve",
        keystones: &["Grasp of the Undying", "Aftershock", "Guardian"],
        slots: [
            &["Demolish", "Font of Life", "Shield Bash"],
            &["Conditioning", "Second Wind", "Bone Plating"],
            &["Overgrowth", "Revitalize", "Unflinching"],
        ],
    },
    TreeData {
        name: "Inspiration",
        keystones: &["Glacial Augment", "Unsealed Spellbook", "First Strike"],
        slots: [
            &["Hextech Flashtraption", "Magical Footwear", "Cash Back"],
            &["Triple Tonic", "Time Warp Tonic", "Biscuit Delivery"],
            &["Cosmic Insight", "Approach Velocity", "Jack Of All Trades"],
        ],
    },
];

const SHARD_SLOTS: [&[&str]; 3] = [
    &["Adaptive Force", "Attack Speed", "Ability Haste"],
    &["Adaptive Force", "Move Speed", "Health Scaling"],
    &["Health", "Tenacity and Slow Resist", "Health Scaling"],
];

static SHARD_PRESETS: LazyLock<Vec<String>> = LazyLock::new(|| {
    let mut combos = Vec::new();
    for a in SHARD_SLOTS[0] {
        for b in SHARD_SLOTS[1] {
            for c in SHARD_SLOTS[2] {
                combos.push(format!("{a}, {b}, {c}"));
            }
        }
    }
    combos
});

fn normalize(value: &str) -> String {
    let trimmed = value.trim();
    let mut chars = trimmed.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}

fn like_filter(value: Option<String>) -> String {
    match value {
        Some(value) if !value.trim().is_empty() => format!("%{}%", value.trim()),
        _ => "%".to_string(),
    }
}

#[derive(Debug)]
struct AppError {
    status: StatusCode,
    message: String,
}

impl AppError {
    fn bad_request(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message: message.into(),
        }
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message: message.into(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let body = Json(serde_json::json!({ "error": self.message }));
        (self.status, body).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(error: sqlx::Error) -> Self {
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            message: error.to_string(),
        }
    }
}
