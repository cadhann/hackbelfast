import { useEffect, useMemo, useRef, useState } from 'react';
import JourneyMap from './components/JourneyMap';
import LocalContextPanel from './components/LocalContextPanel';
import MapLegend from './components/MapLegend';
import PlaceSearch from './components/PlaceSearch';
import PointsPanel from './components/PointsPanel';
import PreferenceList from './components/PreferenceList';
import RouteDetails from './components/RouteDetails';
import RouteModeCards from './components/RouteModeCards';
import { FILTERS } from './config/preferences';
import { DEFAULT_ROUTE_MODE_ID } from './config/routeModes';
import { BELFAST_DEMO_SOURCE, getDemoAccessibilityData, getRouteDemoNotes } from './data/belfastDemoSeed';
import { fetchAccessibilityData } from './services/accessibilityData';
import { buildRouteModes } from './services/routeModes';
import { cacheKey, getCached, setCached } from './services/routeCache';
import { fetchRoutes } from './services/routing';
import { analyzeRoute, getFeatureStats } from './services/routeScoring';
import { combinedBbox, samePoint } from './utils/geo';
import { searchDestinations } from './utils/search';
import './App.css';

const EMPTY_ACC_DATA = { nodes: [], busyWays: [], forbiddenWays: [] };
const MOBILE_BREAKPOINT = 720;

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

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
  const [sidebarOpen, setSidebarOpen] = useState(!isMobileViewport());

  const requestIdRef = useRef(0);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    if (isMobileViewport()) setSidebarOpen(false);
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

  const computeRoute = async (startPoint, endPoint, { force = false } = {}) => {
    if (!startPoint || !endPoint) return;
    if (samePoint(startPoint, endPoint)) {
      rejectSamePoint();
      clearRouteData();
      return;
    }

    const reqId = ++requestIdRef.current;
    const key = cacheKey(startPoint, endPoint);

    if (!force) {
      const cached = getCached(key);
      if (cached) {
        setRoutes(cached.routes);
        setAccData(cached.accData);
        setError(null);
        setWarning(cached.warning || null);
        return;
      }
    }

    setLoading(true); setError(null); setWarning(null);
    try {
      const rs = await fetchRoutes(startPoint, endPoint);
      if (reqId !== requestIdRef.current) return;
      setRoutes(rs);
      const routeWarning = rs.some(route => route.source === BELFAST_DEMO_SOURCE)
        ? 'Using a Belfast demo corridor because the live routing API did not return this route.'
        : null;
      const bbox = combinedBbox(rs);
      let nextAcc = EMPTY_ACC_DATA;
      let nextWarning = null;
      try {
        const data = await fetchAccessibilityData(bbox);
        if (reqId !== requestIdRef.current) return;
        nextAcc = data;
        nextWarning = routeWarning;
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        nextAcc = getDemoAccessibilityData(bbox);
        nextWarning = (
          `${routeWarning ? `${routeWarning} ` : ''}` +
          'Using Belfast demo corridor seed data because the OSM accessibility lookup is blocked or unreachable on this network. ' +
          e.message
        );
      }
      setAccData(nextAcc);
      setWarning(nextWarning);
      setCached(key, { routes: rs, accData: nextAcc, warning: nextWarning });
    } catch (e) {
      if (reqId !== requestIdRef.current) return;
      setError(e.message);
      clearRouteData();
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (start && end) computeRoute(start, end);
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
  const localNotes = useMemo(() => getRouteDemoNotes(chosen), [chosen]);

  const hint = !start
    ? 'Click in Belfast to set your start point'
    : !end
    ? 'Click again to set your destination'
    : null;

  return (
    <div className={`app${sidebarOpen ? ' sidebar-open' : ' sidebar-collapsed'}`}>
      <button
        type="button"
        className="sidebar-handle"
        aria-expanded={sidebarOpen}
        aria-controls="route-sidebar"
        onClick={() => setSidebarOpen(o => !o)}
      >
        <span className="sidebar-handle-bar" aria-hidden="true" />
        <span className="sidebar-handle-label">
          {sidebarOpen ? 'Hide controls' : 'Show route controls'}
        </span>
      </button>

      <aside id="route-sidebar" className="sidebar" aria-label="Route controls">
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
          onRecompute={() => computeRoute(start, end, { force: true })}
        />

        <PreferenceList
          filters={filters}
          filterOptions={FILTERS}
          onChange={(id, checked) => setFilters(prev => ({ ...prev, [id]: checked }))}
        />

        <RouteModeCards modes={routeModes} selectedModeId={selectedMode?.id || selectedModeId} onSelect={setSelectedModeId} />
        <RouteDetails chosen={chosen} selectedMode={selectedMode} featureStats={featureStats} filters={filters} />
        <LocalContextPanel notes={localNotes} />
        <MapLegend />

        <p className="subtitle" style={{ fontSize: 11, marginTop: 18 }}>
          Fastest chooses the shortest available walk, Balanced applies lighter accessibility weighting, and Beacon Accessible uses the full preference weighting. Tactile/audio/kerb signals come from OSM crossing tags within 30 m of the route. Busy-road penalty multiplies meters adjacent to primary/secondary/trunk ways. Crash data toggle is coming soon.
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
