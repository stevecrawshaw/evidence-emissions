# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

This is an [Evidence.dev](https://evidence.dev/) dashboard app (built on SvelteKit) that visualizes greenhouse gas emissions data for England's Combined Authorities (CAs), built for WECA (West of England Combined Authority). Dashboards are written in Markdown files under `pages/` that embed SQL query blocks and Evidence chart/table components — Evidence compiles these into a static site.

## Commands

```bash
npm install                # install dependencies
npm run sources             # (re)build the data sources — run this whenever a .sql/.js file under sources/ changes
npm run sources:strict       # same, but fails the build on source errors
npm run dev                  # start the local dev server (add -- --host 0.0.0.0 in Codespaces)
npm run build                # production build (outputs to build/) — also runs as `npm test`
npm run build:strict         # production build, failing on any query/type errors
npm run preview               # preview the production build locally
```

There is no separate lint/test framework — `npm run build`/`build:strict` is what validates that all SQL queries and pages compile correctly, and is the closest thing to CI here.

Whenever a file inside `sources/` changes (SQL, `connection.yaml`, or the JS source), **run `npm run sources` before `npm run dev`/`npm run build`** or the dashboard will use stale/cached data.

## Architecture

### Data sources (`sources/`)

Two Evidence data sources feed the dashboard, each declared by a `connection.yaml` plus query files. Both are JavaScript sources hitting the WECA open data portal (Opendatasoft/ODS Explore v2.1 API) at build time — no credentials or env vars needed for either.

- **`sources/emissions/`** — `emissions.js` fetches the `ca_la_ghg_emissions_sub_sector_ods_vw` dataset from the ODS `/exports/json` endpoint, with the aggregation (SUM/AVG, GROUP BY, WHERE) done server-side via ODSQL query params baked into the URL, not in DuckDB. This collapses raw sub-sector/greenhouse-gas rows down to one row per (local authority, year, sector) *before* the data ever reaches Evidence — the `/exports/json` endpoint (unlike `/records`, which caps `limit` at 100) honors `select`/`where`/`group_by` and returns the full result set in one call. `la_ghg_sub_sector != 'Large Industrial Installations'` is excluded in that `where` clause because it's a memo item already counted inside Industry's other sub-sectors — summing it in would double-count. `calendar_year` comes back from the API's `date_format(...)` as a string and is coerced to `Number` in JS before export, so downstream SQL can do direct arithmetic (`MAX(calendar_year) - 10`) the same way the old MotherDuck source could. `cauthnm`/`cauthcd` (combined authority) and population are embedded per row directly from the source view, so no separate CA↔LA lookup table exists — `emissions.sql` is `SELECT * EXCLUDE (la_ghg_sector) FROM emissions;`, dropping a harmless duplicate column ODS echoes back alongside the `sector`-aliased one. This replaced a MotherDuck-backed source (`sources/motherduck/`, now deleted) when that share became unreachable.
- **`sources/ods/`** — `ods.js` fetches domestic EPC point data from a different ODS dataset (`lep-epc-domestic-point`) and exports it as a plain array. **This dataset currently 404s upstream** (removed/renamed on the portal) — the source is broken, but harmless, since nothing in `pages/index.md` references its `ods` table (the query that used to do so, `epc`, was dead code and has been removed). Left in place but unfixed since it's unrelated to any other work; investigate the correct dataset ID on the portal if this data is needed again.

Both `.js` files share a documented convention (see their own header comments): avoid backticks/template literals — the Evidence JS-source runner has had issues with them — use string concatenation for messages instead, and use top-level `await fetch(...)` re-thrown on failure so Evidence knows the source failed.

### Dashboard page (`pages/index.md`)

Single-page dashboard. All analytical logic lives in the `sql` fenced blocks at the top of this file, executed in DuckDB syntax against the sources above, and chained together via Evidence's `${query_name}` templating (each block can reference the result of an earlier block as a virtual table). Key patterns:
- `${inputs.xxx}` references values from `<Dropdown>`/`<Checkbox>` components defined later in the page — the SQL blocks are reactive to UI state.
- The `include_ns` checkbox controls whether North Somerset (`local_authority_code = 'E06000024'`, not formally part of WECA) is included in aggregates, filtered once in `emissions_ns` (the base query everything else builds on) — don't re-filter it downstream.
- `per_cap_ns` computes per-capita emissions by summing `emissions_kt_co2e` across sectors per CA-year, and *separately* summing population per CA-year from a per-LA-year-deduplicated population CTE. This two-step split matters: population is repeated on every sector row in `emissions`, so summing it directly over sector rows would inflate it N-fold (N = number of sectors) — always dedupe to one row per (local_authority_code, calendar_year) before summing population. The dedup CTE must use `GROUP BY ... AVG(population_000s)`, not `SELECT DISTINCT`: `population_000s` is itself a server-side `avg(...)` computed per (LA, sector) group in `emissions.js`, and floating-point rounding makes that average come back with tiny differing values across sector rows for the same LA-year (e.g. `200.028` vs `200.02800000000002`) — `DISTINCT` fails to collapse those near-duplicates, silently inflating summed population (and understating per-capita emissions) for any LA where it happens.
- `pivot_sparklines` demonstrates DuckDB's `PIVOT ... USING ARRAY_AGG(...)` to build per-sector sparkline data. The pivot auto-names output columns from the distinct `sector` values present (e.g. `Commercial_emissions_year`, `"Public Sector_emissions_year"` — note the literal space in that one, requiring quoting). `sparklines_totals` and the `<DataTable>`'s `<Column id=...>` both hardcode exactly 4 of the 8 sectors (Commercial, Public Sector, Domestic, Industry) by design — that's a deliberate subset, not the full sector list, so don't "fix" it into `SELECT *`/`COLUMNS(...)` without checking whether all 8 are actually wanted.
- Two `<AreaMap>` blocks (toggled by `{#if inputs.include_ns}`) pull GeoJSON boundaries live from different endpoints (WECA's open data portal vs. ONS/ArcGIS) depending on whether North Somerset is included, since the CA boundary shapes differ.

### Theming (`evidence.config.yaml`)

Defines two color palettes: `default` (Plasma) and `wecaPaletteNew` (WECA brand colors, with separate `light`/`dark` variants) — charts in `pages/index.md` reference `colorPalette=wecaPaletteNew`. The sidebar/header are disabled per-page via `sidebar: "hide"` in the page frontmatter, and the WECA logo is injected in `pages/+layout.svelte` instead.

### Deployment

Deploys to Vercel — see `VERCEL_DEPLOYMENT.md` for details. `vercel.json` sets the build command to `npm run sources && npm run build` (i.e. sources must be rebuilt as part of every deploy) with `build` as the output directory. No environment variables/credentials are required — both data sources fetch from the public ODS API.

### Template housekeeping

- `scripts/update-evidence-packages.js` bumps all `@evidence-dev/*` deps to `latest` (wipes `node_modules`/`package-lock.json` and reinstalls) — run manually when upgrading the Evidence framework version.
- `degit.json` removes `.devcontainer`, `.github`, and `scripts` when this repo is used as a template via `npx degit`.
