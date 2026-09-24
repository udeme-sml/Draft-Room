# Live Draft Room — Status vs Spec

Reference: [`project1_draft_room_spec.md`](project1_draft_room_spec.md)

## Overall

There is a **working WebSocket lobby and draft loop** on a single in-memory room, plus a **console C# client**. The server now broadcasts structured **`draftState`** on `/start` and after each accepted `/pick` (alongside existing `serverMessage` text). The spec’s full **“done” bar** — C# board from that state, draft completion, timer, multi-room, reconnect — is **not met yet**. Roughly **~50%** of core mechanics exist.

**26 automated WebSocket tests** cover lobby behavior, `/pick` rules, and **`draftState`** (see [`TESTS.md`](TESTS.md) for the original 24-scenario checklist plus draft-state tests).

| Area | Spec expectation | Current state |
|------|------------------|---------------|
| Real-time networking | Push on every change | **Partial** — `draftState` + legacy `serverMessage` strings |
| Server-authoritative picks | Validate turn + availability | **Yes** — tested |
| Shared board payload | Structured state for all clients | **Partial (server)** — `draftState` on wire; **C# ignores it** (no-op `case`) |
| Multi-room | Many independent rooms | **No** — one global draft instance |
| Full draft domain | Snake, rounds, timer, end condition | **Partial** — linear wrap only; no completion |
| C# client architecture | Network / model / UI layers | **No** — single `DraftClient/Program.cs` |
| NBA data | BallDontLie API | **No** — hardcoded ~22-player pool |
| “Done” demo | 2+ clients, live board, reject bad picks | **Picks + rejects work**; board not rendered in client yet |

---

## `draftState` protocol (current)

Broadcast to every connected client when the draft **starts** and after each **accepted** `/pick`.

```json
{
  "type": "draftState",
  "turnOrder": ["Alice", "Bob"],
  "onClock": "Alice",
  "picks": [
    { "player": "lebron james", "by": "Alice" }
  ]
}
```

- **`turnOrder`** — drafters in join order at draft start (same as internal `turnOrder`).
- **`onClock`** — whose turn it is now (`null` only before `draftStarted` on server; after start, always a name).
- **`picks`** — chronological list; `player` is normalized pool key (lowercase), `by` is drafter display name.

Internal server also keeps the `players` map (pool → picker or `null`) for validation. `picks` resets when a mid-draft disconnect ends the draft.

---

## Domain (how a draft room works)

| Requirement | Status | Notes |
|-------------|--------|--------|
| Participants in draft order | **Done (pre-start)** | Join order → `turnOrder`; `/start` needs ≥2 players |
| Player pool + picks | **Partial** | Pool in `players` map; history in `draftState.picks` |
| Whose turn | **Partial** | **`onClock` on server**; client does not display it yet |
| Snake / fixed rounds | **Not started** | Simple wrap: `0 → n-1 → 0` |
| Per-pick timer + timeout behavior | **Not started** | No server clock |
| Live board for everyone | **Partial** | Payload exists; C# still uses `serverMessage` for UX |
| Draft ends when picks exhausted | **Not started** | Disconnect mid-draft **resets** draft (tested) |

---

## Server (Node.js)

| Responsibility | Status | Implementation notes |
|----------------|--------|----------------------|
| In-memory state | **Partial** | Single draft instance, not multiple rooms |
| Room + participant on connection | **Partial** | Name on first message; **no room id** |
| Validate actions | **Done (current scope)** | **26 tests** in `server.test.js` |
| Broadcast state changes | **Partial** | Lobby/chat events + **`draftState`** + `serverMessage` |
| Server-side pick clock | **Not started** | — |
| Disconnect / reconnect | **Gap vs spec** | Mid-draft leave ends draft and clears `picks`; **tested** |

**Extras:** lobby chat, `/users`, waiting list (promoted on draft end via `onDraftEnd()`).

**Entry point:** `draft-server/index.js` on **8080**.

---

## Client (C#)

| Responsibility | Status | Notes |
|----------------|--------|--------|
| Connect as participant | **Done** | `ws://localhost:8080` |
| Render draft state | **Minimal** | **`draftState` received, not shown** — empty `case` in `Program.cs` |
| Submit pick / handle reject | **Done (manual)** | `/pick …`; errors in red |
| Reflect others’ picks | **Partial** | `serverMessage` only in UI |
| Layered structure | **Not started** | Monolithic `Program.cs` |

---

## Data

| Spec | Status |
|------|--------|
| BallDontLie API | **Not integrated** — static list in `server.js` |

---

## “Done” criteria (spec § What done looks like)

| Criterion | Met? |
|-----------|------|
| Two+ C# clients, same room | **Yes (manual)** |
| Shared draft board | **Partial** — server sends `draftState`; client does not render |
| Live updates on pick | **Partial** — text + `draftState` on wire |
| Reject out-of-turn / invalid pick | **Yes** — server + tests |

---

## Explicitly out of scope (spec)

Auth, persistence, polished UI, league features, deployment. In-memory-only and console UI align with spec.

---

## Tests & CI

| Item | Status |
|------|--------|
| Checklist | [`TESTS.md`](TESTS.md) — original **24/24** lobby/draft scenarios |
| Node tests | **26 passing** — includes `Empty draft state on start`, `Draft state on pick` |
| Helpers | `draft-server/test-helpers.js` |
| CI | `.github/workflows/test.yml` → `node --test server.test.js` |

**Local:** `cd draft-server && node --test server.test.js`

**Optional hardening:** per-test server instance; extend `startDraftClient` to await post-start `draftState`; document wire protocol in README (done).

---

## Suggested next milestones

1. **C# draft model + console board** — parse `draftState`, print order / on-clock / picks (drop reliance on parsing `serverMessage`).
2. **Draft completion** — N rounds × teams; optional snake order.
3. **Per-pick timer** — server clock + timeout rule.
4. **Multi-room** — room id; isolated state per room.
5. **Reconnect** — reclaim seat without ending draft.
6. **BallDontLie** — populate pool at startup.

---

## Repo layout (high level)

```
Draft Room/
├── project1_draft_room_spec.md
├── README.md
├── STATUS.md
├── TESTS.md
├── draft-server/          # server.js, server.test.js, test-helpers.js
├── DraftClient/
└── .github/workflows/test.yml
```
