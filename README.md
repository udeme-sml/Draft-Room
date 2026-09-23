# Live Draft Room

A real-time multiplayer NBA fantasy draft. A Node.js WebSocket server owns the draft (who is connected, whose turn it is, which players are still available). A C# console client connects, chats, and submits picks. The server rejects out-of-turn and invalid picks.

This is a work in progress. There is one shared room, a hardcoded player pool, and a linear turn order. See [STATUS.md](STATUS.md) for what is done so far.

## Requirements

- [Node.js](https://nodejs.org/) 22
- [.NET 10](https://dotnet.microsoft.com/download) SDK

## Run it

Start the server first (port **8080**):

```bash
cd draft-server
npm install
node index.js
```

In another terminal, start a client. Open a second terminal and run it again to join the same room:

```bash
cd DraftClient
dotnet run
```

The client prints `Name:` after it connects. Type a display name (1–16 characters; spaces become underscores). Then:

| Input                | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `/start`             | Starts the draft. Needs at least two named players.   |
| `/pick LeBron James` | Picks that player on your turn. Case does not matter. |
| `/users`             | Lists everyone currently in the room.                 |
| anything else        | Sent as chat to the other clients.                    |
| `quit`               | Closes the client.                                    |

The pool is the hardcoded list in `draft-server/server.js` (LeBron James, Stephen Curry, and the rest). A player can only be picked once. Turn order is join order and wraps back to the first player.

If you join after `/start`, you wait until the current draft ends (someone disconnects mid-draft). A disconnect during a draft resets picks and ends it.

## Tests

```bash
cd draft-server
node --test server.test.js
```

Twenty-four WebSocket scenarios cover naming, the lobby, `/start`, `/pick`, chat, the waiting list, and disconnects. The same command runs on push via GitHub Actions (`.github/workflows/test.yml`).

## Layout

```
Draft Room/
├── draft-server/          # WebSocket server (index.js, server.js) and tests
├── DraftClient/           # C# console client
└── STATUS.md
```
