# Live Draft Room

A real-time multiplayer NBA fantasy draft. The **Node.js** WebSocket server is the reference implementation (lobby chat, waiting list, disconnect rules). A **Spring Boot** server in `draft-server-java/` speaks the same core protocol on port **8080** (name, `/start`, `/pick`, `draftState`, `serverMessage`) with a **narrower** feature set—no chat, no waiting list, no mid-draft disconnect reset. A **C#** console client connects to either server, chats (Node only), and submits picks. Both servers reject out-of-turn and invalid picks.

One shared in-memory room per process, a hardcoded player pool, and linear turn order (wraps to the first drafter). After `/start` and on each valid `/pick`, the server broadcasts structured **`draftState`** (the C# client accepts it but does not display a board yet). See [STATUS.md](STATUS.md) for progress vs the full project spec.

## Requirements

- [Node.js](https://nodejs.org/) 22 — reference draft server (`draft-server/`)
- [.NET 10](https://dotnet.microsoft.com/download) SDK — console client
- **Optional (Java port):** JDK 25+ and [Maven](https://maven.apache.org/) — `draft-server-java/`

## Run it

Only **one** server can bind to port **8080** at a time.

### Node (full lobby behavior)

```bash
cd draft-server
npm install
node index.js
```

### Java (draft core only)

```bash
cd draft-server-java
mvn spring-boot:run
```

WebSocket endpoint: `ws://localhost:8080/` (same port as Node).

### C# client

One or more clients in separate terminals:

```bash
cd DraftClient
dotnet run
```

Point at a server with the first CLI argument or `DRAFT_SERVER_URL` (see `.env.example`). Default: `ws://localhost:8080`.

```bash
dotnet run ws://localhost:8080
```

When you see `Name:`, enter a display name (1–16 characters; spaces become underscores).

| Input | What it does |
| ----- | ------------ |
| `/start` | Starts the draft (needs at least two named players in the room). |
| `/pick LeBron James` | Picks that player on your turn (case-insensitive; matches pool names in `server.js` / `PlayerPool.java`). |
| `/users` | Lists everyone currently in the room (Node; Java sends `userList` for `/users`). |
| anything else | Chat to other clients on **Node** only (not echoed to you). |
| `quit` | Closes the client. |

On Node, joining after `/start` puts you on a waiting list until the draft ends (e.g. someone disconnects mid-draft, which resets picks). Turn order is join order among active drafters. The Java server rejects new names once the draft has started.

## WebSocket: `draftState`

Sent to **all** connected clients when the draft starts and after each accepted pick (in addition to yellow `serverMessage` lines).

| Field | Meaning |
| ----- | ------- |
| `turnOrder` | Drafter names in order. |
| `onClock` | Who may `/pick` now. |
| `picks` | Array of `{ "player": "<pool key>", "by": "<drafter>" }` in pick order. |

Example after Alice’s first pick in a two-player room:

```json
{
  "type": "draftState",
  "turnOrder": ["Alice", "Bob"],
  "onClock": "Bob",
  "picks": [{ "player": "lebron james", "by": "Alice" }]
}
```

## Tests

```bash
cd draft-server
node --test naming.test.js lobby.test.js draft.test.js
```

**26** scenarios: naming, lobby, `/start`, `/pick` (including errors), chat, waiting list, disconnects, and **`draftState`** on start and pick. CI runs the same command on push (`.github/workflows/test.yml`). Detailed checklist: [TESTS.md](TESTS.md).

```bash
cd draft-server-java
mvn test
```

**16** tests: Spring context smoke, **`DraftRoom`** domain rules (including concurrency), and **`DraftStateOut`** JSON shape. CI does not run Java yet.

## Layout

```
Draft Room/
├── draft-server/          # Node WebSocket server (index.js, server.js) + tests
├── draft-server-java/     # Spring Boot port (domain + WebSocket)
├── DraftClient/           # C# console client
├── STATUS.md              # status vs spec
├── TESTS.md               # server test checklist
└── project1_draft_room_spec.md
```
