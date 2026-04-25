import { useEffect, useMemo, useState } from 'react';
import JourneyMap from './components/JourneyMap';
import MapLegend from './components/MapLegend';
import PlaceSearch from './components/PlaceSearch';
import PointsPanel from './components/PointsPanel';
import PreferenceList from './components/PreferenceList';
import RouteDetails from './components/RouteDetails';
import RouteModeCards from './components/RouteModeCards';
import { FILTERS } from './config/preferences';
import { DEFAULT_ROUTE_MODE_ID } from './config/routeModes';
import { fetchAccessibilityData } from './services/accessibilityData';
import { buildRouteModes } from './services/routeModes';
import { fetchRoutes } from './services/routing';
import { analyzeRoute, getFeatureStats } from './services/routeScoring';
import { combinedBbox, samePoint } from './utils/geo';
import { searchDestinations } from './utils/search';
import './App.css';

const EMPTY_ACC_DATA = { nodes: [], busyWays: [], forbiddenWays: [] };

export default function App() {
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [startQuery, setStartQuery] = useState('');
  const [startSearchOpen, setStartSearchOpen] = useState(false);
  const [selectedStart, setSelectedStart] = useState(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationSearchOpen, setDestinationSearchOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [accData, setAccData] = useState(EMPTY_ACC_DATA);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [selectedModeId, setSelectedModeId] = useState(DEFAULT_ROUTE_MODE_ID);
  const [filters, setFilters] = useState({
    tactile: false,
    audio: false,
    kerb: false,
    avoid_busy: false,
    avoid_crash: false
  });

  const clearRouteData = () => {
    setRoutes([]);
    setAccData(EMPTY_ACC_DATA);
  };

  const closeSearches = () => {
    setStartSearchOpen(false);
    setDestinationSearchOpen(false);
  };

  const rejectSamePoint = () => {
    setError('Start and destination must be different places.');
  };

  const handleMapClick = (latlng) => {
    setError(null); setWarning(null);
    closeSearches();
    if (!start) {
      setStart(latlng);
      setSelectedStart(null);
      setStartQuery('');
    } else if (!end) {
      if (samePoint(start, latlng)) {
        rejectSamePoint();
        return;
      }
      setEnd(latlng);
      setSelectedDestination(null);
      setDestinationQuery('');
    } else {
      setStart(latlng); setEnd(null);
      setSelectedStart(null); setStartQuery('');
      setSelectedDestination(null); setDestinationQuery('');
      clearRouteData();
    }
  };

  const selectStart = (destination) => {
    if (selectedDestination?.id === destination.id || samePoint(destination, end)) {
      rejectSamePoint();
      return;
    }
    setStart({ lat: destination.lat, lng: destination.lng });
    setSelectedStart(destination);
    setStartQuery(destination.name);
    closeSearches();
    setError(null); setWarning(null);
    clearRouteData();
  };

  const selectDestination = (destination) => {
    if (selectedStart?.id === destination.id || samePoint(destination, start)) {
      rejectSamePoint();
      return;
    }
    setEnd({ lat: destination.lat, lng: destination.lng });
    setSelectedDestination(destination);
    setDestinationQuery(destination.name);
    closeSearches();
    setError(null); setWarning(null);
    clearRouteData();
  };

  const clearStart = () => {
    setStart(null);
    setSelectedStart(null);
    setStartQuery('');
    closeSearches();
    clearRouteData();
    setError(null); setWarning(null);
  };

  const clearDestination = () => {
    setEnd(null);
    setSelectedDestination(null);
    setDestinationQuery('');
    closeSearches();
    clearRouteData();
    setError(null); setWarning(null);
  };

  const reset = () => {
    setStart(null); setEnd(null);
    setSelectedStart(null); setStartQuery('');
    setSelectedDestination(null); setDestinationQuery('');
    closeSearches();
    clearRouteData();
    setError(null); setWarning(null);
  };

  const computeRoute = async () => {
    if (!start || !end) return;
    if (samePoint(start, end)) {
      rejectSamePoint();
      clearRouteData();
      return;
    }
    setLoading(true); setError(null); setWarning(null);
    try {
      const rs = await fetchRoutes(start, end);
      setRoutes(rs);
      const bbox = combinedBbox(rs);
      try {
        const data = await fetchAccessibilityData(bbox);
        setAccData(data);
      } catch (e) {
        setAccData(EMPTY_ACC_DATA);
        setWarning(
          'Route shown without accessibility scoring because the OSM accessibility lookup is blocked or unreachable on this network. ' +
          e.message
        );
      }
    } catch (e) {
      setError(e.message);
      clearRouteData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (start && end) computeRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  const routeAnalyses = useMemo(() => {
    return routes.map(route => analyzeRoute(route, accData));
  }, [routes, accData]);
  const routeModes = useMemo(() => buildRouteModes(routeAnalyses, filters), [routeAnalyses, filters]);

  const startResults = useMemo(() => searchDestinations(startQuery), [startQuery]);
  const destinationResults = useMemo(() => searchDestinations(destinationQuery), [destinationQuery]);

  const selectedMode = useMemo(() => {
    return routeModes.find(mode => mode.id === selectedModeId) || routeModes[0] || null;
  }, [routeModes, selectedModeId]);
  const chosenIndex = selectedMode?.routeIndex ?? -1;
  const chosen = selectedMode?.scoredRoute || null;
  const allBlocked = routeAnalyses.length > 0 && routeAnalyses.every(route => route.blocked);
  const featureStats = useMemo(() => getFeatureStats(chosen), [chosen]);

  const hint = !start
    ? 'Click in Belfast to set your start point'
    : !end
    ? 'Click again to set your destination'
    : null;

  return (
    <div className="app">
      <aside className="sidebar" aria-label="Route controls">
        <h1>Accessible Walk — Belfast</h1>
        <p className="subtitle">Compare Fastest, Balanced, and Beacon Accessible walking routes using OpenStreetMap accessibility signals.</p>

        {error && <div className="error" role="alert">{error}</div>}
        {warning && <div className="warning" role="status">{warning}</div>}
        {allBlocked && (
          <div className="error" role="alert">
            All candidate routes pass along motorways or no-access ways. Showing the route with the least forbidden distance — please verify on the ground.
          </div>
        )}

        <PlaceSearch
          title="Start search"
          inputId="start-search"
          query={startQuery}
          placeholder="Try Queen's, City Hall, Lanyon Place..."
          isOpen={startSearchOpen}
          results={startResults}
          emptyMessage="No seeded Belfast start point found."
          selectedOtherPlace={selectedDestination}
          otherPoint={end}
          clearLabel="Clear start"
          clearDisabled={!start && !startQuery}
          onQueryChange={(value) => {
            setStartQuery(value);
            setStartSearchOpen(true);
            setDestinationSearchOpen(false);
            setSelectedStart(null);
          }}
          onFocus={() => {
            setStartSearchOpen(true);
            setDestinationSearchOpen(false);
          }}
          onSelect={selectStart}
          onClear={clearStart}
        />

        <PlaceSearch
          title="Destination search"
          inputId="destination-search"
          query={destinationQuery}
          placeholder="Try Grand Central, City Hall, Titanic..."
          isOpen={destinationSearchOpen}
          results={destinationResults}
          emptyMessage="No seeded Belfast destination found."
          selectedOtherPlace={selectedStart}
          otherPoint={start}
          clearLabel="Clear destination"
          clearDisabled={!end && !destinationQuery}
          onQueryChange={(value) => {
            setDestinationQuery(value);
            setDestinationSearchOpen(true);
            setStartSearchOpen(false);
            setSelectedDestination(null);
          }}
          onFocus={() => {
            setDestinationSearchOpen(true);
            setStartSearchOpen(false);
          }}
          onSelect={selectDestination}
          onClear={clearDestination}
        />

        <PointsPanel
          start={start}
          end={end}
          selectedStart={selectedStart}
          selectedDestination={selectedDestination}
          loading={loading}
          onReset={reset}
          onRecompute={computeRoute}
        />

        <PreferenceList
          filters={filters}
          filterOptions={FILTERS}
          onChange={(id, checked) => setFilters(prev => ({ ...prev, [id]: checked }))}
        />

        <RouteModeCards modes={routeModes} selectedModeId={selectedMode?.id || selectedModeId} onSelect={setSelectedModeId} />
        <RouteDetails chosen={chosen} selectedMode={selectedMode} featureStats={featureStats} filters={filters} />
        <MapLegend />

        <p className="subtitle" style={{ fontSize: 11, marginTop: 18 }}>
          Fastest chooses the shortest available walk, Balanced applies lighter accessibility weighting, and Beacon Accessible uses the full preference weighting. Tactile/audio/kerb signals come from OSM crossing tags within 30 m of the route. Busy-road penalty multiplies meters adjacent to primary/secondary/trunk ways. Crash data toggle is display-only until NI dataset is wired in.
        </p>
      </aside>

      <JourneyMap
        hint={hint}
        loading={loading}
        start={start}
        end={end}
        scored={routeAnalyses}
        chosen={chosen}
        chosenIndex={chosenIndex}
        onMapClick={handleMapClick}
      />
    </div>
  );
}
