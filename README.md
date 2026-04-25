# Accessible Walk — Belfast (hackbelfast)

Walking navigation map for Belfast that biases routes toward accessibility features tagged in OpenStreetMap (tactile paving, audible crossing signals, low/dropped kerbs) and away from busy multi-lane roads.

## Stack

- React 18 + Vite 5
- React-Leaflet 4 / Leaflet 1.9 for the map
- OSRM public demo (`foot` profile) for base routing
- Overpass API for OSM accessibility tags

## Running

```bash
npm install
npm run dev
```

Then open http://localhost:5173/.

## How the routing bias works

OSRM's public demo only returns one route per request, so alternatives are generated client-side by routing through perpendicular waypoints (≈ ±300 m off the midpoint of start→end). Each candidate is then scored:

- **Known-good** features along the route (tactile=yes, audio=yes, low/flush kerb) **subtract** virtual distance.
- **Known-bad** features (tactile=no, raised kerb, signalised crossing without `traffic_signals:sound=yes`) **add** virtual distance.
- **Unknown** is neutral — sparse NI tagging would otherwise dominate the score.
- **Avoid busy** adds 6 m of penalty per real meter the route runs alongside primary/secondary/trunk ways.

The candidate with the lowest *effective* length (real distance + penalties) is rendered solid blue; alternatives are dashed gray.

## Limitations

- NI vehicle crash data is not yet ingested — the toggle is a placeholder.
- OSM accessibility tag coverage in NI is uneven; in low-data areas the only filter that reliably moves the chosen route is **avoid busy**.
- Public OSRM/Overpass endpoints are rate-limited; production deployment would self-host both, or move to GraphHopper with a JSON custom model that bakes accessibility weights into the routing engine itself.
