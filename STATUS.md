# Live Draft Room — Status vs Spec

Reference: [`project1_draft_room_spec.md`](project1_draft_room_spec.md)

## Overall

There is a **working WebSocket lobby and a first-pass draft loop** on a single in-memory “room,” plus a **console C# client** that can talk to the server. The spec’s **“done” bar** (multi-client shared board, authoritative picks with structured live updates, full draft lifecycle) is **not met yet**. Roughly **~40%** of core mechanics exist; architecture, data source, timers, rooms, and reconnect behavior are still ahead. **Server behavior is increasingly covered by automated WebSocket tests** (lobby through first pick); pick validation edge cases are not tested yet.

| Area | Spec expectation | Current state |
|------|------------------|---------------|
| Real-time networking | Push on every change | **Partial** — JSON events over WebSocket; draft updates are mostly free-text `serverMessage`, not board state |
| Server-authoritative picks | Validate turn + availability | **Yes** — `/pick` enforces turn and pool in `draft-server/server.js` |
| Multi-room | Many independent rooms | **No** — one global `turnOrder` / `players` / `draftStarted` |
| Full draft domain | Snake, rounds, timer, end condition | **Partial** — linear turn rotation only; no snake, no per-pick clock, no “draft complete” |
| C# client architecture | Network / model / UI layers | **No** — single `DraftClient/Program.cs` |
| NBA data | BallDontLie API | **No** — hardcoded ~22-player pool |
| “Done” demo | 2+ clients, live board, reject bad picks | **Manual path works for picks**; no structured board; **tests cover lobby + `/start` + one happy `/pick`** (not reject cases) |

---

## Domain (how a draft room works)

| Requirement | Status | Notes |
|-------------|--------|--------|
| Participants in draft order | **Done (pre-start)** | Join order → `turnOrder`; `/start` needs ≥2 players |
| Player pool + picks | **Partial** | Pool is `players` map (name → picker or `null`); picks broadcast as text, not a pick list |
| Whose turn | **Partial** | Server tracks `turn`; clients infer from messages, not a `onClock` field |
| Snake / fixed rounds | **Not started** | Simple wrap: `0 → n-1 → 0`; no snake, no round count |
| Per-pick timer + timeout behavior | **Not started** | No server clock |
| Live board for everyone | **Partial** | All clients get the same `serverMessage` strings; no shared structured state |
| Draft ends when picks exhausted | **Not started** | No round × teams completion; disconnect mid-draft **resets** the draft |

---

## Server (Node.js)

| Responsibility | Status | Implementation notes |
|----------------|--------|----------------------|
| In-memory state | **Partial** | Single draft instance, not “one or more rooms” |
| Room + participant on connection | **Partial** | Participant name on first message; **no room id** |
| Validate actions | **Partial** | Name rules, duplicate names, `/start`, `/pick` turn + player checks |
| Broadcast state changes | **Partial** | `userJoined`, `userList`, `userLeft`, `chat`, `serverMessage`, `error` |
| Server-side pick clock | **Not started** | — |
| Disconnect / reconnect | **Gap vs spec** | Pre-draft: remove from `turnOrder`. **Mid-draft disconnect ends draft**, clears picks, resets `turn` — not “reconnect without corrupting” |

**Extras (not in spec):** lobby chat, `/users`, waiting list when joining after start (promoted on draft end via `onDraftEnd()`).

**Entry point:** `draft-server/index.js` listens on **8080** (matches C# client default).

---

## Client (C#)

| Responsibility | Status | Notes |
|----------------|--------|--------|
| Connect as participant | **Done** | `ws://localhost:8080`; first line sent is treated as name |
| Render draft state | **Minimal** | Colored console output for messages, errors, users, chat |
| Submit pick / handle reject | **Done (manual)** | User types `/pick …`; server errors shown in red |
| Reflect others’ picks in real time | **Partial** | Via broadcast `serverMessage` only |
| Layered structure | **Not started** | No separate networking, model, or presentation projects/classes beyond helpers in `Program.cs` |

---

## Data

| Spec | Status |
|------|--------|
| BallDontLie API (teams, positions, stats) | **Not integrated** — static lowercase name list in `server.js` |

---

## “Done” criteria (spec § What done looks like)

| Criterion | Met? |
|-----------|------|
| Two+ C# clients, same room | **Likely manually** (server supports multiple WebSockets) |
| Shared draft board | **No** — no unified state payload |
| Live updates on pick | **Partial** — text notifications only |
| Reject out-of-turn / invalid pick | **Yes (server)** — **not yet covered by tests** |

---

## Explicitly out of scope (spec)

Correctly **not** pursued: auth, persistence, polished UI, league features, deployment. In-memory-only and console UI align with spec.

---

## Tests & CI

| Item | Status |
|------|--------|
| Node tests (`draft-server/server.test.js`) | **12 tests, all passing** — connection, naming rules, multi-client join, `/users`, pre-draft disconnect |
| Draft flow tests | **Partial** — `/start` (too few players + success), happy-path **`/pick`** with turn advance broadcast |
| Pick rejection tests | **Missing** — out-of-turn, unknown player, already drafted |
| Test helpers (`draft-server/test-helpers.js`) | **In use** — `connectLobby`, `startDraftClient`, `waitForMessage`, etc. |
| GitHub Actions (`.github/workflows/test.yml`) | **Runs** `node --test server.test.js` on push |

**Local check:** `cd draft-server && node --test server.test.js`

---

## Suggested next milestones (aligned to spec)

1. **Structured draft events** — e.g. `draftState` / `pickMade` with order, pool, picks, `onClock`, time remaining (even before UI polish).
2. **Draft completion** — rounds × participants; optional snake order.
3. **Per-pick timer** — server timer + documented timeout rule (auto-pick vs skip).
4. **Multi-room** — room id on connect; isolated state per room.
5. **Reconnect** — identity token or name reclaim without nuking the whole draft.
6. **C# refactor** — connection client, draft model, thin console UI.
7. **BallDontLie** — populate pool at startup (or cache).
8. **Tests** — out-of-turn pick, invalid/duplicate player, mid-draft disconnect; refactor older tests to use `test-helpers` where duplicated.

---

## Repo layout (high level)

```
Draft Room/
├── project1_draft_room_spec.md   # target
├── STATUS.md                     # this file
├── draft-server/                 # WebSocket server + server.test.js, test-helpers.js
├── DraftClient/                  # console WebSocket client
└── .github/workflows/test.yml    # server tests only
```
