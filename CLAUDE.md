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

Two Evidence data sources feed the dashboard, each declared by a `connection.yaml` plus query files:

- **`sources/motherduck/`** — connects to a MotherDuck cloud DuckDB database (`mca_data`). `emissions.sql`, `ca_la_tbl.sql`, and `per_cap.sql` are each just a thin `SELECT *` over pre-built views/tables that live in MotherDuck (`ca_emissions_evidence_long_tbl`, `ca_la_tbl`, `per_cap_emissions_ca_national_vw`). All the heavy transformation logic lives upstream in MotherDuck, not in this repo — these files are intentionally minimal passthroughs. Requires `EVIDENCE_SOURCE__motherduck__token` env var (a MotherDuck token) to connect.
- **`sources/ods/`** — a JavaScript source (`ods.js`) that fetches domestic EPC point data at build time from the WECA open data portal (Opendatasoft API) and exports it as a plain array for Evidence to ingest as a table. No credentials needed. Note the file's own header comment: avoid backticks/template literals in this file — the Evidence JS-source runner has had issues with them, so use string concatenation for messages instead. This data isn't visualized in any page yet.

### Dashboard page (`pages/index.md`)

Single-page dashboard. All analytical logic lives in the `sql` fenced blocks at the top of this file, executed in DuckDB syntax against the sources above, and chained together via Evidence's `${query_name}` templating (each block can reference the result of an earlier block as a virtual table). Key patterns:
- `${inputs.xxx}` references values from `<Dropdown>`/`<Checkbox>` components defined later in the page — the SQL blocks are reactive to UI state.
- A `total_bool` column and the `include_ns` checkbox control whether North Somerset (`local_authority_code = 'E06000024'`, not formally part of WECA) is included in aggregates.
- `pivot_sparklines` demonstrates DuckDB's `PIVOT ... USING ARRAY_AGG(...)` to build the per-sector sparkline data consumed by `<DataTable>` `contentType=sparkarea` columns.
- Two `<AreaMap>` blocks (toggled by `{#if inputs.include_ns}`) pull GeoJSON boundaries live from different endpoints (WECA's open data portal vs. ONS/ArcGIS) depending on whether North Somerset is included, since the CA boundary shapes differ.

### Theming (`evidence.config.yaml`)

Defines two color palettes: `default` (Plasma) and `wecaPaletteNew` (WECA brand colors, with separate `light`/`dark` variants) — charts in `pages/index.md` reference `colorPalette=wecaPaletteNew`. The sidebar/header are disabled per-page via `sidebar: "hide"` in the page frontmatter, and the WECA logo is injected in `pages/+layout.svelte` instead.

### Deployment

Deploys to Vercel — see `VERCEL_DEPLOYMENT.md` for details. `vercel.json` sets the build command to `npm run sources && npm run build` (i.e. sources must be rebuilt as part of every deploy) with `build` as the output directory. The MotherDuck token must be set as a Vercel environment variable (`EVIDENCE_SOURCE__motherduck__token`); env vars can be bulk-copied from the local dev server's `/settings#deploy` page.

### Template housekeeping

- `scripts/update-evidence-packages.js` bumps all `@evidence-dev/*` deps to `latest` (wipes `node_modules`/`package-lock.json` and reinstalls) — run manually when upgrading the Evidence framework version.
- `degit.json` removes `.devcontainer`, `.github`, and `scripts` when this repo is used as a template via `npx degit`.
