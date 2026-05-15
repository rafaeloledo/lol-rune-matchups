# LoL Rune Matchups

Aplicativo local para organizar runas testadas por matchup de League of Legends.

## O que ele faz

- Cadastra matchups como `Jayce vs Shyvana`.
- Armazena arvore primaria, runas primarias, arvore secundaria, runas secundarias e fragmentos.
- Guarda rota, notas, jogos testados, vitorias e confianca.
- Permite filtrar por campeao, oponente e rota.
- Persiste tudo em SQLite no arquivo `data/runes.db`.

## Como rodar

Instale Rust e Cargo. Depois, dentro desta pasta:

```powershell
cargo run
```

Abra:

```text
http://127.0.0.1:8080
```

## API

```text
GET    /api/health
GET    /api/matchups?champion=Jayce&opponent=Shyvana&lane=Top
POST   /api/matchups
GET    /api/matchups/{id}
PUT    /api/matchups/{id}
DELETE /api/matchups/{id}
```

Exemplo de payload:

```json
{
  "champion": "Jayce",
  "opponent": "Shyvana",
  "lane": "Top",
  "primary_tree": "Inspiration",
  "primary_runes": "First Strike, Cash Back, Triple Tonic, Cosmic Insight",
  "secondary_tree": "Sorcery",
  "secondary_runes": "Manaflow Band, Scorch",
  "shards": "Attack Speed, Adaptive Force, Health Scaling",
  "notes": "Boa para poke e controle de wave antes do primeiro item.",
  "games_played": 4,
  "wins": 3,
  "confidence": 4
}
```

## How this project is working

Este projeto e uma aplicacao web local de uma maquina so, sem build step e sem framework de frontend. Tudo gira em torno de tres pecas: um servidor Rust, um SQLite no disco e um frontend estatico servido pelo mesmo binario.

### Arquitetura em alto nivel

```
Browser (HTML + CSS + JS vanilla)
        |  fetch JSON
        v
Servidor Axum em 127.0.0.1:8080
        |  sqlx
        v
SQLite em data/runes.db
```

- **Backend**: um unico binario Rust ([`src/main.rs`](src/main.rs)) construido com [`axum`](https://github.com/tokio-rs/axum) e [`sqlx`](https://github.com/launchbadge/sqlx). Ele faz tres coisas:
  1. Serve os arquivos estaticos da pasta `static/` (HTML, CSS, JS).
  2. Expoe a API REST de matchups (`/api/matchups`) com CRUD completo.
  3. Expoe `/api/enums`, que devolve em JSON todos os valores validos: lista de campeoes, rotas, arvores de runas (com keystone + 3 slots), todos os shards/fragmentos.
- **Banco de dados**: SQLite criado/migrado na primeira execucao. As migrations vivem em `migrations/` e rodam via `sqlx::migrate!`.
- **Frontend**: HTML + CSS + JS sem bundler. O JS faz `fetch('/api/enums')` para preencher os campos e nunca duplica listas de dados — a unica fonte de verdade e o Rust.

### Fonte unica de verdade

Toda a meta-informacao do LoL (campeoes, runas, fragmentos, rotas) esta declarada no Rust como `const`/`static`. Por exemplo, as arvores de runas vivem em `RUNE_TREE_DATA`, com formato `{ name, keystones, slots: [[..], [..], [..]] }` que espelha a estrutura real do client. O endpoint `/api/enums` apenas serializa esses dados.

Beneficios praticos:

- O `validate_input` no servidor e os dropdowns no cliente leem dos mesmos valores — nao tem como o frontend mostrar uma runa que o backend rejeite.
- Adicionar/remover um campeao ou trocar uma keystone e uma edicao so, no Rust.
- Os fragmentos sao gerados em tempo de execucao a partir das 3 linhas reais (Offense / Flex / Defense), produzindo todos os 27 combos validos sem listas manuais.

### Validacao

Todo `POST` e `PUT` passa por `validate_input` antes de tocar o banco:

- `champion`, `opponent`, `lane`, `primary_tree`, `secondary_tree`, `shards` sao checados contra os enums fechados.
- `primary_runes`/`secondary_runes` sao listas separadas por virgula. Cada runa precisa pertencer a arvore correta — runas primarias podem incluir keystone, secundarias nao.
- `wins` nunca pode ser maior que `games_played`.

Erros voltam como `400` com `{"error":"..."}`. O cliente exibe a mensagem na barra de status.

### O combobox customizado

A descoberta na UI usa um combobox proprio (nao o `<datalist>` nativo, que nao aceita CSS). Cada `<input data-list="...">` esta vinculado a um `<datalist>` escondido apenas como fonte de dados. Ao focar o input, o JS:

1. Le os valores do datalist correspondente.
2. Filtra por substring case-insensitive, ordenando por prefix-match > substring-match > posicao.
3. Renderiza um popup `.combobox-popup` posicionado abaixo do input, com a porcao que casou destacada via `<mark>`.
4. Aceita navegacao por **Setas ↑/↓**, commit por **Enter** ou **Tab**, fechamento por **Esc**, e clique do mouse.

Os datalists das runas primarias sao re-populados sempre que o input "Arvore primaria"/"secundaria" muda, garantindo que cada slot mostre apenas as runas validas daquele slot daquela arvore.

### Fluxo tipico de uso

1. `cargo run` sobe o servidor e roda migrations.
2. O browser carrega `index.html`, executa `app.js`, faz `GET /api/enums` e popula todos os datalists.
3. O usuario digita "Ja" no campo Campeao, ve sugestoes (Janna, Jarvan IV, Jax, Jayce) destacando "Ja", aperta Tab/Enter e o valor e fixado.
4. Ao salvar, o cliente monta o payload, manda `POST /api/matchups`, o servidor valida contra os enums, persiste no SQLite e devolve a entrada criada com `id` + timestamps.
5. O cliente recarrega a lista e mostra a nova entrada.

### Arquivos relevantes

- [`src/main.rs`](src/main.rs) — servidor, rotas, validacao, enums.
- [`static/index.html`](static/index.html) — estrutura dos campos e datalists.
- [`static/app.js`](static/app.js) — combobox, fetch, render da lista de matchups, edicao/delete.
- [`static/styles.css`](static/styles.css) — visual, incluindo a estilizacao do combobox.
- [`migrations/`](migrations/) — schema do SQLite.

## Sobre integracao com League of Legends

E possivel obter metadados de partidas por nome de invocador, mas o caminho correto nao e "ler o client" como um site externo faz. O fluxo oficial e usar a Riot Games API:

1. Resolver o jogador por Riot ID, normalmente `gameName` + `tagLine`, para obter o `puuid`.
2. Buscar ids de partidas pelo `puuid` na Match API.
3. Buscar o detalhe da partida por `matchId`.
4. Extrair campeao, runas/perks, spells, lane inferida, itens e participantes.

O client local tambem expoe uma API local chamada League Client Update API enquanto ele esta aberto. Ela e util para automacoes locais e estado do client, mas nao e a melhor base para historico robusto por nome de invocador. Alem disso, ela roda com autenticacao local efemera e muda conforme o client. Para um app pessoal, a integracao mais estavel seria adicionar uma camada opcional com a Riot API oficial e salvar os dados relevantes no SQLite.

Sites como LeagueOfGraphs provavelmente combinam dados da Riot API, pipelines proprios, cache e agregacao estatistica. Eles nao precisam interagir com o client instalado na sua maquina.
