# Baseline Planning Suite: project context and decisions

Case study for innoscripta SE (Senior Frontend Engineer). Three federated React apps (shell, people, delivery) that answer: who works on what, for how long, and what it costs.

Source material (put these in `docs/` in the repo):

- `docs/brief.pdf`: the original case study PDF
- `docs/baseline-seed.json`: fixtures (60 employees, 150 rate records, 4 projects, 90 breakdown items, 720 allocations)

## Assessment weights

Architecture and boundaries 35, domain correctness 30, micro-frontend engineering 20, code quality 15. Not scored: visual polish, design system, auth, mobile, offline, scheduling. They will type specific inputs, then walk the code and ask for a small live change.

## Hard constraints from the brief

- React 18+, TypeScript strict, no `any`.
- No UI libraries (no component kit, headless primitives, table, grid or tree package). Styling tooling and date libraries are fine.
- Three federated builds: shell, people, delivery. Remote URLs resolve at runtime from container config, never from the bundle.
- Each remote runs standalone and hosted from one codebase and one build.
- `docker compose up` from a clean clone serves the suite on localhost:8080. No Node on the host.
- Handover: real commit history, README (how to run, how to break a remote on purpose, repo map), tests where defensible (calculation logic that runs without mounting React matters most).
- A rate edited in People reaches any open Delivery cost view with no reload. Overcapacity is flagged in both apps. If a remote fails, the shell stays alive and shows a message in that panel.

## Domain rules (from the brief)

- Rates are effective-dated. `validFrom` is inclusive, a rate runs until the next one starts, the last has no end.
- Allocation is spread evenly over the working days (Mon to Fri, no public holidays) of its month. Month cost = sum over slices of (working days in slice x hours/day x rate). More than one rate change in a month gives more than two slices.
- An allocation in a month before the employee's first rate costs zero, and the cell is marked.
- One person-month = weeklyHours x (working days in month / 5). Varies by person and month, never a constant. % of capacity = PM x 100.
- Four display units (hours, PM, %, EUR) are conversions of one stored value. Precision: hours 2dp, PM 2dp, % 1dp, cost 2dp. Switching units and back must not change the stored value.
- Editing a cell in EUR divides by that cell's blended rate for the month (blended = cost / hours) to get hours, then converts to the canonical unit.
- Totals are computed from exact values and rounded only for display. Displayed total must equal the sum of displayed cells (largest-remainder).
- Parent breakdown rows are derived and read-only.
- Capacity is 100% of a person-month, summed across ALL projects including unopened ones. Overload is flagged, never blocked. People shows the person as oversubscribed. Delivery names the most recently edited allocation contributing to that person-month.

### Golden reference (must pass first)

A. Okafor (emp-001), 40 h/week, EUR 80/h from 2025-01-01 and EUR 95/h from 2026-03-12, one leaf cell of 0.50 PM in March 2026 (alloc-001):

- March 2026 working days 22; before 12 Mar: 8; from 12 Mar: 14
- 1 PM = 40 x 22 / 5 = 176.00 h; allocation = 88.00 h; 4.00 h/day
- Cost = 8x4x80 + 14x4x95 = 2,560 + 5,320 = EUR 7,880.00
- 50.0% of capacity; implied blended rate EUR 89.5455/h

Seed facts: grid horizon is 2026-04 to 2027-03. alloc-001 is in 2026-03 (outside the default window). Some employees have rates starting after the horizon (emp-053 2027-03-10, emp-041 2027-01-13, emp-047 2027-02-11, emp-028 2026-10-15, emp-034 2026-11-12). emp-003 (Milan Brandt) has alloc-050 and alloc-073, each 0.59 PM in 2026-06, so total 1.18 (the over-capacity case in Figure 5). weeklyHours values: 40, 32, 20.

## Decisions made

### Canonical unit

Store allocation amounts in **person-months**. Matches the seed exactly, % is x100, capacity check is a plain sum > 1.0, unit round trips are lossless. Hours and EUR are derived at the edges.

### Tooling

- **Vite** with `@module-federation/vite`, runtime registration via `@module-federation/runtime` (`init({ remotes })`, `loadRemote()`). Verify plugin config against current docs. Test with `vite build` and the production images, not only the dev server. Needs `build.target: 'esnext'`, correct `base` per remote, `react` and `react-dom` as singletons. Fallback if Vite fights back: Rspack with `@module-federation/enhanced`. Prove shell loading one remote in Docker FIRST.
- **pnpm workspaces** monorepo: `apps/shell`, `apps/people`, `apps/delivery`, `docker/`, `integration/`.
- One root `tsconfig.base.json` (strict) extended by all apps. One root ESLint config with `no-explicit-any` as an error. Vitest for tests, `fast-check` for property tests.
- **No shared contracts package.** Contracts are consumer-owned ports plus contract tests (see below).

### Docker and runtime config

- **Separate nginx containers**: shell on 8080, people on 8081, delivery on 8082, single `docker compose up`.
- Shell container entrypoint writes `/config.json` from env vars (`PEOPLE_REMOTE_URL`, `DELIVERY_REMOTE_URL`), defaults `http://localhost:8081/remoteEntry.js` and `http://localhost:8082/remoteEntry.js`. URLs are resolved by the browser, so never use docker service names.
- Remotes send CORS header `Access-Control-Allow-Origin` from env `ALLOWED_ORIGIN` (default http://localhost:8080).
- Cache headers: `config.json` no-store, `remoteEntry.js` no-cache, hashed assets long-cache.
- Shell fetches config (validate its shape), registers remotes, loads via `import('./bootstrap')` pattern so shared modules initialize first. If `config.json` fails to load, show an explicit error screen.
- Each remote gets its own ErrorBoundary + Suspense + load timeout (about 5s) in the shell.
- Break-on-purpose for README: `docker compose stop people`, or `PEOPLE_REMOTE_URL=http://localhost:9999/remoteEntry.js docker compose up` for the timeout path.
- Standalone mode: each remote has its own `index.html` entry that ignores config.json and wires fixture adapters and a local event bus.

### Persistence

- **IndexedDB via `idb`**, one database per remote: `baseline-people` (employees, rateRecords, meta) and `baseline-delivery` (projects, breakdownItems, allocations, meta). Shell state (currency, active user) in `localStorage` under `baseline-shell:`. Shell opens no IndexedDB.
- `indexedDB.open` only inside each app's `adapters/` folder (lint rule). Delivery never opens `baseline-people`.
- Each remote seeds only its own slice on first open (script generates per-app slice files from `baseline-seed.json`, IDs and values intact). `meta.seedVersion`, seed in one transaction. Versioned schema with an upgrade function.
- Indexes: rateRecords by `employeeId`; allocations by `employeeId+month` (powers the cross-project capacity sum).
- Each allocation has a monotonic `seq` (seed order initially, bumped on each amount edit) to determine "most recently edited".
- Multi-step writes in single transactions. A "Reset demo data" action per remote.
- Known limit: IndexedDB is scoped by page origin, so in hosted mode all remotes run on the shell origin and ownership is enforced by convention plus lint, not by the browser. Standalone remotes (8081, 8082) have separate datasets from hosted. Document in README.

### Architecture (ports and adapters)

Per app: `domain/` (pure TS, no imports of React or IO) -> `ports/` (interfaces) -> `adapters/` (IndexedDB, in-memory, fixtures) -> `ui/`. Dependencies point inward. Constructor/function injection only, no DI container, no generic Repository<T> base class.

The shell is the **composition root, not middleware**. It loads each remote's `api` module eagerly, creates adapters, and injects them as props into the `App` modules. It stays out of the data path. It hosts and injects the event bus and passes currency and active user as props (not events).

Each remote exposes two modules: `people/api` (`createEmployeeQuery()`, `createRateQuery()`) and `people/App`; `delivery/api` (capacity totals adapter) and `delivery/App`. Keep injected objects as plain functions and data, no class instances across the boundary.

**Rates decision (the graded one):** Delivery reads **raw rate records** and owns the cost engine (slice math, blended rate, coverage flags). Reasons: the EUR-edit needs the blended rate from slice math; the grid renders 720 cells synchronously; "before first rate costs zero and is marked" falls out of raw records; People then needs no calendar math. Cost: Delivery embeds the rule "validFrom inclusive, last rate open-ended", pinned down by the contract test.

Ports (each owned by its consumer):

```ts
type Availability<T> = { status: 'ok'; data: T } | { status: 'unavailable' };

// delivery/src/ports
interface EmployeeQuery {
  listEmployees(): Promise<Availability<Employee[]>>;
} // id, name, weeklyHours
interface RateQuery {
  getRates(ids: string[]): Promise<Availability<Record<string, RateRecord[]>>>;
}

// people/src/ports
interface AllocationTotals {
  getMonthlyTotals(
    ids: string[],
  ): Promise<Availability<{ employeeId: string; month: string; allocatedPM: number }[]>>;
}
```

Batch reads. Delivery loads rates into an in-memory read model and renders synchronously. A null-object adapter returns `unavailable` when the other remote failed to load. Over-capacity threshold: total > 1 + 1e-9, applied on each side, kept consistent by a contract test.

Events (publisher owns the definition, payload is minimal, subscribers re-read through the port; handlers idempotent; handlers wrapped in try/catch inside publish):

- `rate:changed { employeeId }` (owned by People; Delivery re-reads)
- `allocation:changed { employeeId, month }` (owned by Delivery; People re-reads totals)
  Keep visited panels mounted (hidden) so "open Delivery view" updates live; Delivery also re-reads on mount. BroadcastChannel for cross-tab is optional.

### Tests

- Unit tests inside each app (`tests/unit`), pure domain, no React. Golden reference lives in Delivery.
- Consumer-owned contract suite as a function over the port, e.g. `runRateQueryContract(factory)` in `apps/delivery/tests/contracts`, run against Delivery's fixture adapter.
- `integration/contracts` runs the same suite against People's real adapter. People's CI must run Delivery's contract suite before release. Root script `pnpm test:contracts`.
- Run date tests under two time zones (e.g. TZ=America/Los_Angeles and TZ=Pacific/Auckland).
- Property tests (`fast-check`) for largest-remainder: sum identity, each cell within 1 unit of exact, parent identities.

### Behaviour decisions

7. **March reference cell:** keep alloc-001 loaded (counts toward capacity). Grid takes a `months` list with prev/next controls shifting the 12-month window; default starts Apr 26, one step back shows March. Golden unit test. Seed script asserts every seeded allocation is on a leaf.
8. **Adding a child under an allocated leaf:** MOVE all of the leaf's allocations to the new child in one transaction, show a message ("Moved N allocations from X to Y"). Totals unchanged (test before/after). Do not bump `seq` on moved rows. No depth cap at 3. Same function for "move node". Forbid moving a node under its own descendant; moves stay within one project. Delete asks for confirmation (count of allocations and PM), runs in one transaction, publishes `allocation:changed` for every affected person-month.
9. **Rate validation:** unique `(employeeId, validFrom)` (including when a correction moves a date); `hourlyCost` finite, > 0, max 2 decimals; `validFrom` a real calendar date. Add, correct, remove anywhere in history; always sort by `validFrom`; one `rate:changed` per save. Removing first or only record is allowed (cells then cost zero and are marked). Coverage union `'full' | 'partial' | 'none'` per cell (partial when the first rate starts mid-month; uncovered days cost zero, cell marked). Disable cost input in `none` cells (blended rate 0). Use a date-only type (`{y,m,d}`) or date lib in date-only mode, never `new Date('YYYY-MM-DD')` with local getters.
10. **Currency and user:** store EUR. Shell holds a static FX table (EUR, USD, GBP, illustrative, labeled in README), passes `{ code, perEur }` as a prop, persists choice in `localStorage`. Typing a cost in non-EUR: divide by `perEur`, then by blended rate. People edits rates in EUR only, with read-only converted values. Active user is a header dropdown with fixed names passed as a prop; optional `editedBy` stamp on allocation edits.
11. **Rounding:** work in scaled integers (value x 10^dp): 2dp hours, PM, cost; 1dp %. Convert units on exact values first, never on rounded ones. Leaf rows authoritative: largest-remainder across months so row total = round(exact sum). Parent rows and footers = sums of displayed children (integers). Trade-off to state in README: a parent total can differ from the nearest-rounded exact value by a few last-place units. Ties go to earliest index. Add a small epsilon before flooring (0.285*100 = 28.499999999999996). Reject negative or non-finite input.

## Planned build order (also the commit history)

1. Monorepo scaffold, tsconfig/eslint base, Docker for three containers, shell loading one remote at runtime from config.json (prove federation first).
2. Domain engine in Delivery with tests: date-only type, working days, rate slicing, PM/hours/%/EUR conversion, blended rate, largest-remainder rounding. Golden test passes before anything else.
3. People domain: rate history validation, tests.
4. Persistence adapters (idb) + seed slice script + reset.
5. Ports, contract suite, null-object adapters, event bus, shell composition root.
6. Delivery UI: breakdown tree (create, rename, move, delete), staffing grid (4 units, editable leaf cells, derived parents, totals, overcapacity naming).
7. People UI: searchable register, rate history editor, oversubscription flag.
8. Resilience (error boundary, timeout), shell chrome (nav, currency, user).
9. README: run, break a remote, repo map, decisions and trade-offs (rates approach, PM canonical, consumer-owned contracts, rounding, origin/IndexedDB caveat, FX assumptions).

## Working agreements for Claude Code

- Make small, meaningful commits (real history is a deliverable). Do not squash.
- Domain code stays pure and testable without React. Run the golden test first whenever the engine changes.
- No `any`, no UI libraries, no dead scaffolding.
- Ask before deviating from the decisions above, and record any deviation in the README.
