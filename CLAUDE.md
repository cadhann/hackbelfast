# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server on http://localhost:5173 (auto-opens browser)
npm run build    # Production build
npm run preview  # Preview production build
```

No linter or test framework is configured.

## Environment

Copy `.env.local` and set `VITE_ELEVENLABS_API_KEY` for audio turn-by-turn cues (optional — browser TTS is the fallback). Vite proxies `/api/overpass` → Overpass API and `/api/geocode` → Nominatim so CORS isn't an issue in dev.

## Architecture

SafeStep is a React + Leaflet accessible walking navigation app for Belfast. The core data flow is:

```
User sets start/end (map click or search)
  → computeRoute() in App.jsx
    → fetchRoutes() in services/routing.js
      → fetchGraphRoutes()  [preferred]
          graphBuilder.js  — Overpass fetch → adjacency graph + spatial grid
          graphRouter.js   — runs A* per mode, penalises edges for diversity
          astar.js         — edgeCost() applies OSM tag weights + filter boosts
        OR fetchOsrmFallback()  [if Overpass/graph unavailable]
      → fetchAccessibilityData()  [parallel bbox fetch for scoring data]
          fallback: getDemoAccessibilityData() from data/belfastDemoSeed.js
  → analyzeRoute() in services/routeScoring.js  — measures feature metres/counts along route
  → buildRouteModes() in services/routeModes.js — scores + picks best route per mode
  → JourneyMap renders chosen route; BottomSheet sidebar shows options
```

### Routing pipeline detail

**`services/astar.js`** — The edge cost function (`edgeCost`) is where all routing biases live. It applies:
- Physical distance as the base cost
- Always-on surcharges (steps ×3, busy roads ×0.5 per metre)
- Per-filter weight-scaled penalties (e.g. `avoid_steps: 14 m/m`)
- Crossing-node penalties (tactile/audio/kerb tags)
- Shopping/pleasant-walk discounts on tagged ways

**`services/graphBuilder.js`** — Fetches foot-traversable OSM ways via Overpass, builds an adjacency list and a spatial grid (≈88 m cells) for nearest-node snapping. Hard exclusions: motorway, construction, `foot=no/private`, `access=no` without explicit foot permission.

**`services/graphRouter.js`** — Iterates the three route modes (beacon → balanced → fastest). For each mode: one A* pass, then edge-penalise ×4 and re-run to find a diverse alternative. Deduplicates by 18-point route fingerprint.

**`services/routeScoring.js`** — `analyzeRoute()` measures how many metres of each feature type (busy, steps, narrow, unlit, etc.) overlap the route, and counts POIs/crossings near it. `scoreRouteAnalysis()` converts that into a 0–1 accessibility score using `PENALTIES` from `config/preferences.js`.

### Config is where weights live

- **`config/routeModes.js`** — weight vectors for Fastest / Balanced / Beacon Accessible
- **`config/preferences.js`** — the 16 filter definitions and `PENALTIES` constants used by the scorer
- **`config/walkingPace.js`** — 6 pace presets + per-crossing signal delay (22 s) + turn delay (4 s)
- **`config/profiles.js`** — saved personas bundling a pace, mode, and filter preset

### State management

All state lives in `App.jsx` — no global store. Route results flow down as props. Auto-recalculation (with `force: true`) fires when filters, mode, pace, or departure time change while start/end are set.

### Key patterns

- **Cache**: `services/routeCache.js` — keyed on snapped start/end coords; `force: true` bypasses it.
- **Timed closures**: `services/timedAccess.js` evaluates park gates / peace gates against departure time.
- **OSRM fallback**: generates 5 candidates (direct + 4 perpendicular offsets at ±800 m / ±1600 m) when the custom graph is unavailable.
- **Accessibility data sparsity**: scores are suppressed (shown as unknown) when fewer than 3 crossing nodes are found near the route.
