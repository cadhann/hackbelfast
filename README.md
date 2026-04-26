# SafeStep Belfast

SafeStep Belfast is an accessibility-first walking navigator for Belfast. It combines live foot routing, OpenStreetMap accessibility data, Belfast-specific seed fixtures, and explainable scoring so users can compare routes by confidence and usability rather than just shortest time.

The app is aimed at walkers who need more than a generic fastest route: wheelchair users, blind and low-vision users, older walkers, parents with prams, carers, and anyone who wants clearer information about crossings, kerbs, steps, lighting, rest points, and route risk.

## What the app does

- Search any Belfast start point or destination using seeded landmarks plus live geocoding.
- Generate multiple walking route candidates and rank them with three route modes:
  - `Fastest`: shortest walk with light preference nudges
  - `Balanced`: direct route with lighter accessibility weighting
  - `Beacon Accessible`: accessibility-first weighting
- Apply bundled walking profiles, pace presets, and departure-time-aware routing context.
- Apply accessibility preferences for:
  - tactile paving
  - audio crossing cues
  - low / dropped kerbs
  - avoiding busy roads
  - avoiding steps
  - wider pavements
  - better lighting
  - smoother surfaces
  - gentler slopes
  - simpler navigation
  - toilets and seating nearby
  - accessible station links
  - verified route reports
  - crash-risk hotspots and corridors
- Show explainable route details, route-health summaries, support-place markers, and confidence chips.
- Support live navigation with optional ElevenLabs voice guidance and browser speech fallback.
- Include Belfast-specific seeded landmarks, support places, crash-risk hotspots, reports, and difficult junction notes so the product still feels local when live APIs are unreliable.
- Warn about best-effort timed pedestrian access at selected Belfast parks and gates.

## Stack

- React 18 + Vite 5
- React-Leaflet / Leaflet for the map
- Belfast-bounded geocoding via Nominatim
- Overpass for live OSM accessibility and walking-network data
- Custom graph router:
  - fetches the local foot network from Overpass
  - runs A* with preference-weighted edge costs
  - generates genuinely different route candidates by mode
- OSRM foot backend as fallback when the custom router is unavailable
- Optional ElevenLabs TTS for live navigation audio

## Routing architecture

The app no longer just asks a public router for one route and decorates it afterwards.

It uses a two-layer approach:

1. `Custom graph routing`  
   The app fetches Belfast foot-network data from Overpass, builds a graph, and runs A* with costs derived from route-mode weights and active accessibility filters. This means preferences can directly affect pathfinding rather than only post-hoc ranking.

2. `Fallback routing`  
   If the graph router is unavailable, the app falls back to a public walking backend and deduplicated offset alternatives so route generation still works.

After route generation, each candidate is analysed again for route-health details, support places, reports, crash-risk exposure, and confidence signals. The final UI shows both the chosen route and the reasons behind it.

## Accessibility and data model

SafeStep scores and explains routes using a mix of live and seeded Belfast data:

- crossing tags such as tactile paving, audible signals, and kerbs
- busy-road and restricted-way proximity
- steps, narrow pavements, lighting, and street lamps
- surface quality and slope
- nearby toilets, seating, and station access
- community route reports
- Belfast crash-risk hotspots and higher-risk corridors
- timed-access places such as parks and peace gates

Unknown data stays unknown. The app does not pretend incomplete coverage is the same as a safe route.

## Belfast-specific seed layer

The project includes a Belfast fallback/fixture layer for:

- landmarks and search suggestions
- support places such as toilets, seating, and station access
- rough-surface and steep-slope segments
- community accessibility reports
- crash-risk hotspots and corridors
- difficult junction notes and crossing examples

This is there to keep the demo locally grounded and resilient when live lookups are blocked or sparse.

## Live navigation and voice

When a route is active, the app can switch into a live navigation HUD with:

- current instruction
- distance to next maneuver
- following-step preview
- simulated walking mode for demos
- optional ElevenLabs voice output

If no ElevenLabs API key is present, the app falls back to browser speech synthesis.

## Running locally

```bash
npm install
npm run dev
```

Vite starts on `http://localhost:5173/` by default.

The dev server proxies:

- `/api/overpass` -> Overpass API
- `/api/geocode` -> Nominatim

That keeps local development working on networks that block some direct browser requests.

## Build

```bash
npm run build
```

## Optional environment variables

You can run the app without any env vars, but these are supported:

- `VITE_ELEVENLABS_API_KEY`  
  Optional. Enables ElevenLabs voice output for live navigation.

- `VITE_GEOCODER_BASE_URL`  
  Optional. Override the default geocoder base. Useful if you want to point production traffic at your own proxy/provider instead of direct client requests.

## Product notes

- The report dialog is currently a demo UI only. Reports are not persisted or submitted anywhere yet.
- Public Overpass / routing / geocoding services are rate-limited and can be blocked on some networks.
- The crash-risk layer is currently a combination of Belfast seed fixtures and derived live risk heuristics, not an official road-collision integration.
- Timed-access places are best-effort guidance for demo purposes, not authoritative opening-hours data.
- OpenStreetMap accessibility coverage is still uneven, so route quality depends on how much data exists around the chosen corridor.

## Repo structure

- [src/App.jsx](src/App.jsx): main app shell and state orchestration
- [src/services/routing.js](src/services/routing.js): route generation entry point
- [src/services/graphRouter.js](src/services/graphRouter.js): custom A* graph router
- [src/services/routeScoring.js](src/services/routeScoring.js): route analysis and scoring
- [src/services/accessibilityData.js](src/services/accessibilityData.js): live Overpass accessibility data
- [src/services/geocoding.js](src/services/geocoding.js): Belfast-bounded search and reverse geocoding
- [src/services/elevenlabs.js](src/services/elevenlabs.js): optional voice playback
- [src/data/belfastDemoSeed.js](src/data/belfastDemoSeed.js): Belfast seed merge layer
- [src/data/belfastAccessibilityFixtures.js](src/data/belfastAccessibilityFixtures.js): Belfast support-place, report, slope, surface, and crash fixtures

## Next steps

The strongest production upgrades would be:

- self-hosted routing / Overpass / geocoding infrastructure
- persisted community reporting
- official collision and station-access datasets
- stronger moderation / freshness pipelines for reports
- authenticated user preferences and saved journeys
