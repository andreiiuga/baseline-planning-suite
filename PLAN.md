# Implementation plan

Each stage ends with a **gate** (checks that must pass) and one or more **commits**. Do not start the next stage until the gate is green. Every stage leaves the repository in a working state.

## Commit rules

- Conventional Commits: `type(scope): imperative summary`. Types: `feat`, `fix`, `test`, `refactor`, `chore`, `build`, `docs`, `ci`.
- Scopes: `shell`, `people`, `delivery`, `docker`, `repo`, `integration`, `seed`.
- Subject up to about 72 characters, no trailing period. Add a body when the *why* is not obvious.
- **No mention of AI tools or assistants anywhere in commit messages, and no `Co-authored-by` or "Generated with" trailers.** Author identity is the developer's own git config.
- One logical change per commit. Tests may land in the same commit as the code they cover, or in a `test:` commit just before it for domain logic.
- No squashing and no force-push to rewrite history after pushing. Push at the end of every stage.
- Before pushing, run the hygiene check below.

```bash
# fails (exit 1) if any commit message mentions an AI tool or has an attribution trailer
! git log --format=%B | grep -iE "claude|anthropic|co-authored-by|generated with"
```

Claude Code adds attribution to commits and PRs by default. Turn it off in `.claude/settings.json` (committed to the repo or kept in user settings):

```json
{ "attribution": { "commit": "", "pr": "" } }
```

Check the current docs for the exact key names (`attribution`, and the older `includeCoAuthoredBy`), then make a throwaway commit and inspect it with `git log -1 --format=%B` to confirm nothing is appended.

## Standing gate (run at the end of every stage)

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Stages that touch build or runtime config also run `docker compose build` and a smoke check in the browser. Each stage lists what *else* to verify.

---

## Stage 0: Repository bootstrap

**Do**
- Create the GitHub repo `baseline-planning-suite`, clone over SSH.
- Add `docs/brief.pdf`, `docs/baseline-seed.json`, `CLAUDE.md`, `README.md`, `PLAN.md`, `.gitignore`, `.editorconfig`.

**Gate**
- `git remote -v` shows the SSH URL, push works without a password prompt.

**Commits**
1. `docs(repo): add case study brief and seed fixtures`
2. `docs(repo): add architecture decisions and implementation plan`

---

## Stage 1: Monorepo tooling

**Do**
- `pnpm-workspace.yaml`, root `package.json`, `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`), ESLint with `@typescript-eslint/no-explicit-any` as error, Prettier, Vitest at root.
- Empty `apps/shell`, `apps/people`, `apps/delivery` each with `package.json`, `tsconfig.json` extending the base, and a trivial test.
- Scripts at root: `typecheck`, `lint`, `test`, `test:contracts` (placeholder).

**Gate**
- Standing gate passes on the empty apps.
- Deliberately add an `any` in a scratch file, confirm lint fails, remove it.

**Commits**
1. `chore(repo): set up pnpm workspace and strict TypeScript base`
2. `chore(repo): add ESLint, Prettier and Vitest`
3. `chore(repo): scaffold shell, people and delivery packages`

---

## Stage 2: Federation proof in Docker (highest risk, do it early)

**Do**
- Minimal React app in each package built with Vite + `@module-federation/vite`.
- `people` and `delivery` expose `./App` (a placeholder component) and `./api` (a stub function). They also build a standalone `index.html`.
- Shell: `import('./bootstrap')` pattern, fetch `/config.json`, validate shape, `init({ remotes })`, `loadRemote()` the two `App`s, each in its own ErrorBoundary + Suspense + timeout.
- `react`/`react-dom` declared as singletons everywhere.
- Dockerfile (multi-stage, targets `shell|people|delivery`), nginx configs (CORS from `ALLOWED_ORIGIN`, cache headers), `entrypoint-shell.sh` that writes `config.json`, `docker-compose.yml` with ports 8080/8081/8082.
- Fallback decision point: if the Vite plugin cannot do runtime remotes in a production build after a bounded effort, switch to Rspack + `@module-federation/enhanced` and record why in the README.

**Gate**
- `docker compose up --build` from a clean clone; the shell shows both placeholder panels.
- DevTools Network: remote URLs come from `config.json`, not from the shell's JS bundle (`grep -r "8081" apps/shell/dist` finds nothing).
- Only one React instance loads (check with a console log of `React.version` identity, or the shared-scope debug output).
- `http://localhost:8081` and `:8082` run standalone.
- Break tests: `docker compose stop people` shows the fallback panel and Delivery still works; a dead-host URL shows the fallback after the timeout.
- Change `PEOPLE_REMOTE_URL` and restart with no rebuild; the new URL is used.

**Commits**
1. `build(repo): configure Vite module federation for people and delivery`
2. `feat(shell): load remotes at runtime from config.json`
3. `feat(shell): isolate remote failures with error boundary and timeout`
4. `build(docker): add multi-stage image, nginx configs and compose file`
5. `docs(repo): document how to break a remote on purpose`

---

## Stage 3: Delivery domain, dates and working days

**Do** (pure TypeScript, no React, in `apps/delivery/src/domain`)
- `dates.ts`: date-only type `{ y, m, d }`, parse/format ISO, compare, days-in-month, weekday computation without `Date` local getters.
- `workingDays(month)` and `workingDaysBetween(from, to)` (Monday to Friday).
- Tests first: March 2026 = 22, February 2026 = 20, a month starting on a weekend, leap year February, ranges that start or end on weekends.

**Gate**
- Standing gate.
- `TZ=America/Los_Angeles pnpm test` and `TZ=Pacific/Auckland pnpm test` both pass.

**Commits**
1. `test(delivery): cover date-only arithmetic and working days`
2. `feat(delivery): add date-only type and working-day calculation`

---

## Stage 4: Rate slicing and coverage

**Do**
- `rates.ts`: given sorted rate records and a month, return slices `{ from, to, workingDays, hourlyCost }[]` and `coverage: 'full' | 'partial' | 'none'`.
- Handles: no records, first record after month end, first record mid-month (uncovered days cost zero), `validFrom` inclusive, three or more records in one month, a record exactly on the 1st.
- Rejects unsorted input by sorting defensively; document it.

**Gate**
- Standing gate.
- Test with real seed cases: `emp-001` March 2026 (8 + 14), `emp-007` May 2026 (rate on the 14th), and `emp-053` (first rate later than the horizon is not an issue, but a rate starting after the month yields `none`).

**Commits**
1. `test(delivery): cover rate slicing and coverage edge cases`
2. `feat(delivery): split months into rate slices with coverage flag`

---

## Stage 5: Units and the golden reference

**Do**
- `units.ts`: person-month in hours for (employee weeklyHours, month); conversions PM <-> hours <-> % <-> EUR; blended rate; cell cost from PM + slices; EUR-to-PM for edits (divide by blended rate, then convert).
- Discriminated union `Unit = 'pm' | 'hours' | 'pct' | 'eur'`; converters in a table (no switch sprawl).
- **Golden test first**: 22 / 8 / 14 working days, 176.00 h, 88.00 h, 4.00 h/day, EUR 7,880.00, 50.0%, EUR 89.5455/h.
- Round-trip tests: PM -> unit -> PM returns the identical stored value for all four units, across several employees (weekly hours 40, 32, 20) and months.
- `none` coverage: cost input conversion is undefined, return a typed refusal rather than dividing by zero.

**Gate**
- Standing gate; the golden test passes and is named clearly so a reviewer can find it.

**Commits**
1. `test(delivery): add golden reference calculation for the Okafor March cell`
2. `feat(delivery): convert between person-months, hours, percent and cost`
3. `test(delivery): verify lossless unit round trips`

---

## Stage 6: Rounding and reconciliation

**Do**
- `rounding.ts`: scaled-integer largest-remainder apportionment, ties to earliest index, epsilon before flooring, reject negative/non-finite.
- Display formatting per unit (2/2/1/2 decimal places) built on top of it.
- Property-based tests (`fast-check`): sum of displayed cells equals displayed total; each cell is within one unit of exact; stable under input reordering of non-tied values; the `0.285 * 100` case.

**Gate**
- Standing gate; property tests run with a fixed seed in CI and a random seed locally.

**Commits**
1. `test(delivery): add property tests for largest-remainder rounding`
2. `feat(delivery): apportion rounded totals so displayed values reconcile`

---

## Stage 7: Rollups and capacity

**Do**
- `rollup.ts`: given the tree and leaf values, derive parents, row totals, column totals, grand total as sums of **displayed** leaf values (integers).
- `capacity.ts`: per person-month total PM across all projects, `over = total > 1 + 1e-9`, culprit = contributing allocation with the highest `seq`.
- Tests with seed data: `emp-003` June 2026 totals 1.18 and is over; culprit is the one with the larger `seq` (assert both orderings by changing `seq`); a total exactly 1.0 from `0.1 + 0.7 + 0.2` is not flagged.

**Gate**
- Standing gate.
- Reconciliation test over the whole seed: every displayed parent equals the sum of its displayed children, every row/column/grand total reconciles.

**Commits**
1. `feat(delivery): derive parent rows and totals from displayed leaf values`
2. `feat(delivery): detect cross-project overcapacity and pick the causing allocation`
3. `test(delivery): reconcile all totals across the seed data`

---

## Stage 8: Breakdown tree domain

**Do**
- `breakdown.ts` (pure, operates on immutable data and returns a result plus a list of changes): create, rename, move, delete.
- Adding a child under an allocated leaf moves its allocations to the new child (no `seq` change) and returns a message payload; moving a node under an allocated leaf uses the same path.
- Guards: no move into own descendant, same-project only, no empty names.
- Delete returns the allocations and PM affected, for the confirmation dialog and for `allocation:changed` events.

**Gate**
- Standing gate.
- Test: totals before and after adding a child under an allocated leaf are equal; no allocation is lost; `seq` untouched on moved rows.
- Test on a real level-3 leaf from the seed (e.g. `wbs-012`).

**Commits**
1. `test(delivery): cover tree operations and allocation moves`
2. `feat(delivery): implement breakdown tree create, rename, move and delete`

---

## Stage 9: People domain, rate history

**Do**
- `apps/people/src/domain`: add/correct/remove with validation (unique `(employeeId, validFrom)`, positive finite cost with at most 2 decimals, real calendar date), always sorted result.
- Reuse is not shared code: People gets its own small date-only helper if needed (accepted duplication, noted in README).
- Search function for the register (name and role, case-insensitive).

**Gate**
- Standing gate; tests for duplicates created by a correction, retroactive insert before the first record, removing the only record.

**Commits**
1. `test(people): cover rate history validation and ordering`
2. `feat(people): implement rate history add, correct and remove`
3. `feat(people): add employee register search`

---

## Stage 10: Seed slices and persistence

**Do**
- `scripts/make-seed-slices.ts`: split `docs/baseline-seed.json` into `people-seed.json` and `delivery-seed.json`; assert counts (60 / 150 / 4 / 90 / 720), unique IDs, that every allocation sits on a leaf, and that `alloc-001` exists. Add `seq` in file order.
- `idb` adapters: `baseline-people`, `baseline-delivery`; schema v1 with upgrade function; indexes (`employeeId`; `employeeId+month`); seeding in one transaction guarded by `meta.seedVersion`; reset function.
- Repository interfaces in `ports/`, in-memory implementations used in tests.
- ESLint rule: `indexedDB`/`openDB` usage allowed only under `adapters/`.
- Run the same repository tests against the in-memory and IndexedDB implementations (`fake-indexeddb` in Vitest).

**Gate**
- Standing gate.
- Seed script fails loudly if a count or invariant is wrong (test it by corrupting a copy).
- Lint rule fires when `openDB` is used in `domain/` (check, then revert).
- Manual: in the browser, DevTools shows both databases after loading; reload keeps edits; reset restores the seed.

**Commits**
1. `feat(seed): generate per-app seed slices and validate fixture invariants`
2. `feat(people): persist employees and rates in IndexedDB`
3. `feat(delivery): persist projects, breakdown and allocations in IndexedDB`
4. `chore(repo): restrict IndexedDB access to adapters`

---

## Stage 11: Ports, event bus and contracts

**Do**
- Consumer-owned ports: `EmployeeQuery`, `RateQuery` in Delivery; `AllocationTotals` in People; shared `Availability<T>` shape declared in each (duplicated on purpose).
- Event bus with typed event map, unsubscribe function, handler errors isolated; standalone local bus.
- Null-object adapters returning `unavailable`.
- Contract suite `runRateQueryContract(factory)` in Delivery; run against Delivery's fixture adapter. Same idea for `AllocationTotals` (suite owned by People).
- `exposed/api.ts` in each remote returning real adapters.
- `integration/contracts`: run the suites against the real adapters from the other app.
- Update the federation config to expose `./api`.

**Gate**
- Standing gate plus `pnpm test:contracts`.
- Break test: rename a field in People's adapter, confirm the integration test fails, revert.

**Commits**
1. `feat(delivery): define rate and employee ports with fixture adapters`
2. `feat(people): define allocation totals port`
3. `feat(shell): add typed event bus with isolated handlers`
4. `test(integration): verify providers satisfy consumer contracts`
5. `feat(people): expose rate and employee query adapters`
6. `feat(delivery): expose allocation totals adapter`

---

## Stage 12: Shell composition root

**Do**
- Load both `api` modules eagerly; build adapters (real or null-object depending on load result); inject into `App`s with bus, currency and active user props.
- Navigation that keeps visited panels mounted (hidden).
- Header: currency picker (EUR/USD/GBP static table, persisted in `localStorage`), active user dropdown.

**Gate**
- Standing gate and `docker compose up --build`.
- Break tests again: stop `delivery`, People shows "capacity unavailable" rather than crashing; stop `people`, Delivery shows costs as unavailable; both up, everything wired.
- Switching currency re-renders both remotes without a reload.

**Commits**
1. `feat(shell): wire remote adapters, bus and shared state into panels`
2. `feat(shell): add navigation that preserves visited panels`
3. `feat(shell): add currency and active user controls`

---

## Stage 13: People UI

**Do**
- Searchable register (list, filter as you type), employee detail with rate history table and add/correct/remove forms, inline validation messages, EUR-only editing with read-only converted value.
- Oversubscription badge from `AllocationTotals` (re-read on `allocation:changed` and on mount).
- Publishes `rate:changed` after every successful save.
- Accessible tables and form labels (keyboard navigable).

**Gate**
- Standing gate and UI tests with Testing Library for the form validation and the badge.
- Manual: edit, reload, data persists; duplicate date is refused with a message; retroactive insert works.

**Commits**
1. `feat(people): add searchable employee register`
2. `feat(people): add rate history editor with validation`
3. `feat(people): flag oversubscribed employees from delivery totals`

---

## Stage 14: Delivery UI, breakdown tree

**Do**
- Hand-built tree component (no libraries): expand/collapse, keyboard navigation, create/rename/move/delete, confirmation dialog on delete with counts, message after moving allocations.
- Project selector for the four projects.

**Gate**
- Standing gate and component tests for tree interactions.
- Manual: add a child under `wbs-012`, confirm the message and that totals do not change; try to move a node under its own descendant, confirm refusal.

**Commits**
1. `feat(delivery): render the breakdown tree with expand and collapse`
2. `feat(delivery): add create, rename, move and delete for breakdown items`

---

## Stage 15: Delivery UI, staffing grid

**Do**
- Hand-built grid: rows = breakdown items with per-person rows under each leaf, 12 month columns, TOTAL column, footer; parents read-only and derived.
- Unit switcher (PM, hours, %, EUR) using the stored PM; editable leaf cells with parse/validate; EUR edits via blended rate; disabled input with tooltip for `none` coverage; cells marked for zero-cost/partial coverage.
- Window shift controls (previous/next) so March 2026 is reachable.
- Currency applied to the EUR view.
- Overcapacity marker (†) with the culprit named in the message; flagged, never blocked.
- Edit writes the allocation, bumps `seq`, publishes `allocation:changed`.

**Gate**
- Standing gate and UI tests for editing and unit switching.
- Manual script (the "reviewer will type these" list):
  1. Shift back to March 2026, open Okafor's cell, EUR view shows 7,880.00; hours 88.00; PM 0.50; % 50.0.
  2. Switch units back and forth ten times, the stored value is unchanged.
  3. Type 7,880.00 in EUR in that cell, PM stays 0.50.
  4. June 2026, Milan Brandt shows the over-capacity marker and names the most recently edited allocation; editing the other one changes the named culprit.
  5. Totals: displayed total equals the sum of displayed cells in every row and column.

**Commits**
1. `feat(delivery): render the staffing grid with derived parent rows`
2. `feat(delivery): edit leaf cells in any display unit`
3. `feat(delivery): shift the visible month window`
4. `feat(delivery): flag overcapacity and name the causing allocation`

---

## Stage 16: Live updates and cross-app behaviour

**Do**
- Delivery subscribes to `rate:changed`, re-reads rates, recomputes; also re-reads on mount.
- People re-reads totals on `allocation:changed`.
- End-to-end test (Playwright, run against the compose stack) of the headline requirement: edit a rate in People, switch back to Delivery (still mounted), cost updated without reload.
- Resilience e2e: stop a remote, shell still works.

**Gate**
- Standing gate plus the e2e suite against `docker compose up`.
- Manual: the Okafor March cost changes immediately after editing the 12 March rate.

**Commits**
1. `feat(delivery): refresh costs when rates change`
2. `feat(people): refresh capacity flags when allocations change`
3. `test(repo): add end-to-end tests for live updates and remote failure`

---

## Stage 17: Standalone mode and reset

**Do**
- Standalone entries use fixture/in-memory adapters and a local bus, never `config.json`.
- "Reset demo data" action in each app.
- Verify standalone works on 8081 and 8082 from the same build artifacts as hosted.

**Gate**
- Standing gate; manual run of both ports; standalone Delivery with the fixture `RateQuery` shows costs from the seed rates.

**Commits**
1. `feat(people): support standalone mode with local adapters`
2. `feat(delivery): support standalone mode with local adapters`
3. `feat(repo): add reset demo data action`

---

## Stage 18: Hardening

**Do**
- Run date-heavy tests under both time zones in CI scripts.
- Review for dead code and leftover scaffolding; remove placeholder tests and stubs from stage 2.
- Accessibility pass (labels, focus, keyboard in grid and tree).
- Performance check: typing in a cell must not stall with 720 cells (memoise derived rows, avoid recomputing slices per render).
- Confirm no `any` (`grep -rn ": any" apps`), no UI library in `package.json` dependencies.
- Clean-clone test: fresh clone in a new directory, `docker compose up --build`, nothing else installed except Docker.

**Gate**
- Everything above passes. Clean-clone run is green.

**Commits**
1. `refactor(repo): remove scaffolding and unused code`
2. `perf(delivery): memoise derived grid rows`
3. `fix(repo): accessibility and keyboard handling`
4. `ci(repo): run date tests under multiple time zones`

---

## Stage 19: Final documentation and review

**Do**
- Re-read `README.md` against the actual code: every command, path, port and claim.
- Add the final repo map, the break-a-remote instructions as actually tested, known limitations, and the "what I would do next" list.
- Run the commit hygiene check, review `git log --oneline` for a readable story.
- Rehearse the live-change walkthrough: pick three small changes (add a currency, add a column to the register, change the capacity threshold) and see how many files each touches. If any needs more than two files, refactor.

**Gate**
- Hygiene check passes, the clean-clone run passes, the README matches reality.

**Commits**
1. `docs(repo): align README with the implemented system`
2. `docs(repo): add limitations and next steps`

---

## Order-of-risk summary

1. Stage 2 (federation in production builds on Docker) is the biggest unknown. Do it first.
2. Stages 3 to 7 carry the domain score (30%) and are fully testable without a browser. Keep them tight.
3. Stage 11 to 12 carry the architecture score (35%). Keep ports small and the shell out of the data path.
4. Stages 13 to 17 are UI and wiring; visual polish is not scored, so keep styling minimal.

## Reviewer-facing checklist (run before submitting)

- [ ] Golden reference passes and is easy to find
- [ ] March 2026 cell reachable in the UI and shows EUR 7,880.00
- [ ] Unit switching and back never changes the stored value
- [ ] Displayed totals equal sums of displayed cells everywhere
- [ ] Brandt June 2026 flagged in both apps, culprit named in Delivery
- [ ] Rate edit in People updates Delivery with no reload
- [ ] Stopping any one container leaves the shell and the other app working
- [ ] Remote URLs absent from bundles, present only in `config.json`
- [ ] Standalone and hosted from the same build
- [ ] `docker compose up` works from a clean clone
- [ ] No `any`, no UI libraries, no leftover scaffolding
- [ ] Commit history is readable and contains no tool or assistant references
