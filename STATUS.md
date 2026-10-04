# Live Draft Room — Status vs Spec

Reference: [`project1_draft_room_spec.md`](project1_draft_room_spec.md)

## Overall

There is a **working WebSocket lobby and draft loop** on a single in-memory room (**Node**), plus a **console C# client** that can target either server via URL. Both servers broadcast structured **`draftState`** on `/start` and after each accepted `/pick` (alongside `serverMessage` text).

The **Spring Boot** port (`draft-server-java/`) is **complete for its scoped implementation** (domain, WebSocket handler, Maven + integration tests, Docker image, EC2 deploy path, CI job). Core naming, `/start`, and `/pick` work end-to-end with the C# client against local or remote Java. It is **not** feature-parity with Node and has **lifecycle gaps** documented under [Known issues (Java)](#known-issues-java).

The spec’s full **“done” bar** — C# board from that state, draft completion, timer, multi-room, reconnect — is **not met yet**. Roughly **~50%** of the overall product spec on Node; the **Java port scope is ~100%** of what was planned for the parallel server (narrow subset, not full spec).

**26 automated WebSocket tests** cover Node lobby behavior, `/pick` rules, and **`draftState`** (see [`TESTS.md`](TESTS.md) for the original 24-scenario checklist plus draft-state tests). **18** Maven tests cover Java domain, outbound JSON, and WebSocket integration.

| Area | Spec expectation | Current state |
|------|------------------|---------------|
| Real-time networking | Push on every change | **Partial** — `draftState` + `serverMessage` (Node + Java draft path) |
| Server-authoritative picks | Validate turn + availability | **Yes (Node)** — tested; **Yes (Java)** — domain + integration tests |
| Shared board payload | Structured state for all clients | **Partial (server)** — `draftState` on wire; **C# ignores it** (no-op `case`) |
| Multi-room | Many independent rooms | **No** — one global draft instance per server process |
| Full draft domain | Snake, rounds, timer, end condition | **Partial** — linear wrap only; **no completion** on either server |
| C# client architecture | Network / model / UI layers | **No** — single `DraftClient/Program.cs`; **configurable `DRAFT_SERVER_URL` / CLI URL** |
| NBA data | BallDontLie API | **No** — hardcoded ~22-player pool |
| Java / Spring Boot port | Same core protocol on 8080 | **Done (scoped)** — see gaps below |
| “Done” demo | 2+ clients, live board, reject bad picks | **Picks + rejects work**; board not rendered in client yet |

---

## Known issues (Java)

These are **accepted** limitations of the current Java server (not bugs in the C# client or Node reference).

1. **Less feature-complete than Node** — no lobby chat, no waiting list, join-after-start rejected, no BallDontLie/timer/multi-room/reconnect. `/users` and minimal `userJoined` / `userList` exist for parity with basic lobby UX.
2. **The draft never ends** — there is no “draft complete” flow and **disconnect does not reset** `DraftRoom`. On Node, the practical way to end a draft is a **mid-draft disconnect**, which clears picks and allows a fresh lobby. On Java, `afterConnectionClosed` only drops the WebSocket session; **`draftStarted` remains true** and drafters stay in `turnOrder`.
3. **Stale room after everyone leaves** — if all clients disconnect and new ones connect to the **same JVM instance**, naming fails with **`Draft already started, wait for it to end`** (or related errors). Recovery today: **restart the Java process** (or redeploy the container). This is the most visible operational gap vs Node.

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

Internal server also keeps the `players` map (pool → picker or `null`) for validation on Node. `picks` resets when a mid-draft disconnect ends the draft on **Node** only.

---

## Domain (how a draft room works)

| Requirement | Status | Notes |
|-------------|--------|-------|
| Participants in draft order | **Done (pre-start)** | Join order → `turnOrder`; `/start` needs ≥2 players |
| Player pool + picks | **Partial** | Pool in `players` map (Node) / `PlayerPool` (Java); history in `draftState.picks` |
| Whose turn | **Partial** | **`onClock` on server**; client does not display it yet |
| Snake / fixed rounds | **Not started** | Simple wrap: `0 → n-1 → 0` |
| Per-pick timer + timeout behavior | **Not started** | No server clock |
| Live board for everyone | **Partial** | Payload exists; C# still uses `serverMessage` for UX |
| Draft ends when picks exhausted | **Not started** | Node: disconnect mid-draft **resets** draft (tested); Java: **no end** (see known issues) |

---

## Server (Node.js)

| Responsibility | Status | Implementation notes |
|----------------|--------|----------------------|
| In-memory state | **Partial** | Single draft instance, not multiple rooms |
| Room + participant on connection | **Partial** | Name on first message; **no room id** |
| Validate actions | **Done (current scope)** | **26 tests** in `naming.test.js`, `lobby.test.js`, `draft.test.js` |
| Broadcast state changes | **Partial** | Lobby/chat events + **`draftState`** + `serverMessage` |
| Server-side pick clock | **Not started** | — |
| Disconnect / reconnect | **Gap vs spec** | Mid-draft leave ends draft and clears `picks`; **tested** |

**Extras:** lobby chat, `/users`, waiting list (promoted on draft end via `onDraftEnd()`).

**Entry point:** `draft-server/index.js` on **8080**.

---

## Server (Java — Spring Boot)

Parallel port beside Node; same WebSocket port **8080** and core message types for naming, `/start`, `/pick`, **`draftState`**, **`serverMessage`**, **`error`**, plus minimal **`userJoined`** / **`userList`** for join and `/users`. Scoped implementation **finished** (including Docker + EC2 path and CI).

| Responsibility | Status | Implementation notes |
|----------------|--------|----------------------|
| Spring Boot app | **Done** | Boot **4.1.1**, Java **25**; context smoke test |
| Domain: join / start / pick | **Done** | `DraftRoom`, `PlayerPool`, `Pick`, `DraftState`; unit tests incl. concurrency |
| Hardcoded 22-player pool | **Done** | Keys aligned with `draft-server/server.js` |
| `draftState` on wire | **Done** | `DraftStateOut` + Jackson; serialization test |
| WebSocket handler | **Done** | `DraftWebSocketHandler` + `WebSocketConfig` at `/` |
| WebSocket integration tests | **Done** | `DraftWebSocketIntegrationTest` (start + pick) |
| Thread safety | **Partial** | `synchronized` on `DraftRoom`; session set is concurrent |
| Docker image | **Done** | Multi-stage `Dockerfile`; local `docker build` / `docker run -p 8080:8080` |
| Remote deploy | **Done (manual)** | Image save/load or registry + EC2; security group **8080** |
| Parity vs Node | **Gap (documented)** | No chat; no wait list; **no draft end / disconnect reset** |
| Black-box parity tests | **Not started** | Node test suite not run against Java on 8080 |

**Entry point:** `draft-server-java` — `mvn spring-boot:run` (port **8080** per `application.properties`).

---

## Client (C#)

| Responsibility | Status | Notes |
|----------------|--------|--------|
| Connect as participant | **Done** | Default `ws://localhost:8080`; override via arg or `DRAFT_SERVER_URL` |
| Render draft state | **Minimal** | **`draftState` received, not shown** — empty `case` in `Program.cs` |
| Submit pick / handle reject | **Done (manual)** | `/pick …`; errors in red |
| Reflect others’ picks | **Partial** | `serverMessage` only in UI |
| Layered structure | **Not started** | Monolithic `Program.cs` |

---

## Data

| Spec | Status |
|------|--------|
| BallDontLie API | **Not integrated** — static list in `server.js` / `PlayerPool.java` |

---

## “Done” criteria (spec § What done looks like)

| Criterion | Met? |
|-----------|------|
| Two+ C# clients, same room | **Yes (manual)** — Node or Java |
| Shared draft board | **Partial** — server sends `draftState`; client does not render |
| Live updates on pick | **Partial** — text + `draftState` on wire |
| Reject out-of-turn / invalid pick | **Yes** — Node + tests; **Java** — domain + integration tests |

---

## Explicitly out of scope (spec)

Auth, persistence, polished UI, league features, deployment. In-memory-only and console UI align with spec. **Java EC2/Docker** are portfolio/demo deploy for the port, not spec “done” requirements.

---

## Tests & CI

| Item | Status |
|------|--------|
| Checklist | [`TESTS.md`](TESTS.md) — original **24/24** lobby/draft scenarios |
| Node tests | **26** in `naming.test.js`, `lobby.test.js`, `draft.test.js` — includes `Empty draft state on start`, `Draft state on pick` |
| Helpers | `draft-server/test-helpers.js` |
| Java tests | **18** — `DraftRoomTest`, `DraftStateOutTest`, `DraftWebSocketIntegrationTest`, `DraftServerJavaApplicationTests` |
| CI | `.github/workflows/test.yml` → **Node** (`node --test …`) **and** **Java** (`mvn -B test`) |

**Local (Node):** `cd draft-server && node --test naming.test.js lobby.test.js draft.test.js`

**Local (Java):** `cd draft-server-java && mvn test`

**Optional hardening:** per-test server instance on Node; extend `startDraftClient` to await post-start `draftState`; run Node black-box tests against Java; fix Java draft lifecycle (end on last disconnect or explicit reset).

---

## Suggested next milestones

1. **C# draft model + console board** — parse `draftState`, print order / on-clock / picks (drop reliance on parsing `serverMessage`).
2. **Java draft lifecycle** — align with Node disconnect-reset **or** add explicit `/end` / empty-room reset so reconnecting clients are not stuck on “draft already started”.
3. **Node black-box suite on Java** — same tests on port 8080 when Java is the server (will surface parity gaps).
4. **Draft completion** — N rounds × teams; optional snake order.
5. **Per-pick timer** — server clock + timeout rule.
6. **Multi-room** — room id; isolated state per room.
7. **Reconnect** — reclaim seat without ending draft.
8. **BallDontLie** — populate pool at startup.

---

## Repo layout (high level)

```
Draft Room/
├── README.md
├── STATUS.md
├── .env.example              # DRAFT_SERVER_URL for client
├── draft-server/             # server.js, naming/lobby/draft.test.js, test-helpers.js
├── draft-server-java/        # Spring Boot port (domain + WebSocket + Dockerfile)
├── DraftClient/
└── .github/workflows/test.yml
```
