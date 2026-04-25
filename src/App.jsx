import { useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from './components/BottomSheet';
import DirectionsBar from './components/DirectionsBar';
import JourneyMap from './components/JourneyMap';
import LocalContextPanel from './components/LocalContextPanel';
import MapLegend from './components/MapLegend';
import PreferenceList from './components/PreferenceList';
import RouteDetails from './components/RouteDetails';
import RouteModeCards from './components/RouteModeCards';
import { formatDistance, formatDuration } from './utils/format';
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

const EMPTY_ACC_DATA = {
  nodes: [],
  busyWays: [],
  forbiddenWays: [],
  stepsWays: [],
  narrowWays: [],
  litWays: [],
  unlitWays: [],
  streetLamps: []
};
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
    avoid_steps: false,
    pavement_width: false,
    streetlights: false,
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

  const swapPoints = () => {
    setStart(end); setEnd(start);
    setSelectedStart(selectedDestination); setSelectedDestination(selectedStart);
    setStartQuery(destinationQuery); setDestinationQuery(startQuery);
    closeSearches();
  };

  const candidateCount = routeAnalyses.length;
  const peekContent = loading ? (
    <div className="sheet-peek-summary muted">
      <div className="sheet-peek-time">Routing…</div>
      <div className="sheet-peek-meta">Finding accessible alternatives</div>
    </div>
  ) : chosen ? (
    <div className="sheet-peek-summary">
      <div className="sheet-peek-time">{formatDuration(chosen.route.duration)}</div>
      <div className="sheet-peek-meta">
        <span>{formatDistance(chosen.route.distance)}</span>
        <span className="dot">·</span>
        <span>{selectedMode?.title || 'Route'}</span>
        {candidateCount > 0 && (
          <>
            <span className="dot">·</span>
            <span>{candidateCount} option{candidateCount === 1 ? '' : 's'}</span>
          </>
        )}
      </div>
    </div>
  ) : (
    <div className="sheet-peek-summary muted">
      <div className="sheet-peek-time">No route yet</div>
      <div className="sheet-peek-meta">{hint || 'Pick a start and destination'}</div>
    </div>
  );

  return (
    <div className={`app${sidebarOpen ? ' sheet-open' : ' sheet-peek'}`}>
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

      <div className="top-card">
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">🦮</span>
          <span className="brand-title">Accessible Walk · Belfast</span>
        </div>
        <DirectionsBar
          startQuery={startQuery}
          startSearchOpen={startSearchOpen}
          startResults={startResults}
          selectedStart={selectedStart}
          start={start}
          destinationQuery={destinationQuery}
          destinationSearchOpen={destinationSearchOpen}
          destinationResults={destinationResults}
          selectedDestination={selectedDestination}
          end={end}
          onStartChange={(value) => {
            setStartQuery(value);
            setStartSearchOpen(true);
            setDestinationSearchOpen(false);
            setSelectedStart(null);
          }}
          onStartFocus={() => { setStartSearchOpen(true); setDestinationSearchOpen(false); }}
          onStartClear={clearStart}
          onSelectStart={selectStart}
          onDestChange={(value) => {
            setDestinationQuery(value);
            setDestinationSearchOpen(true);
            setStartSearchOpen(false);
            setSelectedDestination(null);
          }}
          onDestFocus={() => { setDestinationSearchOpen(true); setStartSearchOpen(false); }}
          onDestClear={clearDestination}
          onSelectDestination={selectDestination}
          onSwap={swapPoints}
        />
        {loading && (
          <div className="route-status routing" role="status">
            <span className="status-spinner" aria-hidden="true" />
            <span className="status-text">Routing… finding accessible options</span>
          </div>
        )}
        {!loading && start && end && chosen && (
          <button
            type="button"
            className="route-status ready"
            onClick={() => computeRoute(start, end, { force: true })}
            aria-label="Reroute with current preferences"
          >
            <span className="status-icon" aria-hidden="true">↻</span>
            <span className="status-text">
              Route ready · tap to <strong>reroute</strong>
            </span>
          </button>
        )}
        {!loading && start && end && !chosen && !error && (
          <div className="route-status pending" role="status">
            <span className="status-icon" aria-hidden="true">…</span>
            <span className="status-text">Waiting for route</span>
          </div>
        )}
        {(error || warning || allBlocked) && (
          <div className="banner-stack">
            {error && <div className="banner banner-error" role="alert">{error}</div>}
            {warning && <div className="banner banner-warn" role="status">{warning}</div>}
            {allBlocked && (
              <div className="banner banner-error" role="alert">
                All candidate routes pass along motorways or no-access ways. Showing the route with the least forbidden distance — please verify on the ground.
              </div>
            )}
          </div>
        )}
      </div>

      <div className="fab-stack">
        <button
          type="button"
          className="fab"
          onClick={reset}
          disabled={!start && !end}
          aria-label="Clear points"
          title="Clear"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <BottomSheet
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        peek={peekContent}
      >
        <RouteModeCards modes={routeModes} selectedModeId={selectedMode?.id || selectedModeId} onSelect={setSelectedModeId} />
        <PreferenceList
          filters={filters}
          filterOptions={FILTERS}
          onChange={(id, checked) => setFilters(prev => ({ ...prev, [id]: checked }))}
        />
        <RouteDetails chosen={chosen} selectedMode={selectedMode} featureStats={featureStats} filters={filters} />
        <LocalContextPanel notes={localNotes} />
        <MapLegend />
        <p className="footnote">
          Fastest = shortest walk. Balanced applies lighter accessibility weighting. Beacon Accessible uses the full preference set. Crossing data comes from OSM tags within 30 m of the route. Crash data is coming soon.
        </p>
      </BottomSheet>
    </div>
  );
}
