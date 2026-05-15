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

## Sobre integracao com League of Legends

E possivel obter metadados de partidas por nome de invocador, mas o caminho correto nao e "ler o client" como um site externo faz. O fluxo oficial e usar a Riot Games API:

1. Resolver o jogador por Riot ID, normalmente `gameName` + `tagLine`, para obter o `puuid`.
2. Buscar ids de partidas pelo `puuid` na Match API.
3. Buscar o detalhe da partida por `matchId`.
4. Extrair campeao, runas/perks, spells, lane inferida, itens e participantes.

O client local tambem expoe uma API local chamada League Client Update API enquanto ele esta aberto. Ela e util para automacoes locais e estado do client, mas nao e a melhor base para historico robusto por nome de invocador. Alem disso, ela roda com autenticacao local efemera e muda conforme o client. Para um app pessoal, a integracao mais estavel seria adicionar uma camada opcional com a Riot API oficial e salvar os dados relevantes no SQLite.

Sites como LeagueOfGraphs provavelmente combinam dados da Riot API, pipelines proprios, cache e agregacao estatistica. Eles nao precisam interagir com o client instalado na sua maquina.
