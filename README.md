# Live Draft Room

A real-time multiplayer NBA fantasy draft. A **Node.js** WebSocket server owns the draft today (connections, turn order, pool, picks). A **Spring Boot** port lives in `draft-server-java/` (domain logic in progress; not on the wire yet). A **C#** console client connects, chats, and submits picks. The server rejects out-of-turn and invalid picks.

One shared in-memory room, a hardcoded player pool, and linear turn order (wraps to the first drafter). After `/start` and on each valid `/pick`, the server broadcasts a structured **`draftState`** message (the C# client accepts it but does not display a board yet). See [STATUS.md](STATUS.md) for progress vs the full project spec.

## Requirements

- [Node.js](https://nodejs.org/) 22 — run the lobby and draft server
- [.NET 10](https://dotnet.microsoft.com/download) SDK — console client
- **Optional (Java port):** JDK 25+ and [Maven](https://maven.apache.org/) — `draft-server-java/`

## Run it

Start the server (port **8080**):

```bash
cd draft-server
npm install
node index.js
```

Start one or more clients (separate terminals):

```bash
cd DraftClient
dotnet run
```

When you see `Name:`, enter a display name (1–16 characters; spaces become underscores).

| Input | What it does |
| ----- | ------------ |
| `/start` | Starts the draft (needs at least two named players in the room). |
| `/pick LeBron James` | Picks that player on your turn (case-insensitive; matches pool names in `server.js`). |
| `/users` | Lists everyone currently in the room. |
| anything else | Chat to other clients (not echoed to you). |
| `quit` | Closes the client. |

Joining after `/start` puts you on a waiting list until the draft ends (e.g. someone disconnects mid-draft, which resets picks). Turn order is join order among active drafters.

### Java server (work in progress)

Not a drop-in replacement yet. When the WebSocket layer is wired, it will use the same port and protocol as Node:

```bash
cd draft-server-java
mvn spring-boot:run
```

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

Spring context smoke test only until domain and WebSocket tests land.

## Layout

```
Draft Room/
├── draft-server/          # Node WebSocket server (index.js, server.js) + tests
├── draft-server-java/     # Spring Boot port (in progress)
├── DraftClient/           # C# console client
├── STATUS.md              # status vs spec
├── TESTS.md               # server test checklist
└── project1_draft_room_spec.md
```
