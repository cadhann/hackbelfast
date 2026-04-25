import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BottomSheet from './components/BottomSheet';
import DirectionsBar from './components/DirectionsBar';
import JourneyMap from './components/JourneyMap';
import MapLegend from './components/MapLegend';
import NavigationHud from './components/NavigationHud';
import PreferenceList from './components/PreferenceList';
import RouteDetails from './components/RouteDetails';
import RouteModeCards from './components/RouteModeCards';
import { useGpsTracking } from './hooks/useGpsTracking';
import { useNavigation } from './hooks/useNavigation';
import { DEFAULT_VOICE_ID } from './services/elevenlabs';
import { formatDistance, formatDuration } from './utils/format';
import { FILTERS } from './config/preferences';
import { DEFAULT_ROUTE_MODE_ID } from './config/routeModes';
import { getDemoAccessibilityData } from './data/belfastDemoSeed';
import { fetchAccessibilityData } from './services/accessibilityData';
import { buildRouteModes } from './services/routeModes';
import { cacheKey, getCached, setCached } from './services/routeCache';
import { fetchRoutes } from './services/routing';
import { analyzeRoute, getFeatureStats, scoreRouteAnalysis } from './services/routeScoring';
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
  streetLamps: [],
  toilets: [],
  seating: [],
  stations: [],
  communityReports: [],
  roughWays: [],
  steepWays: []
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
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [filters, setFilters] = useState({
    tactile: false,
    audio: false,
    kerb: false,
    avoid_busy: false,
    avoid_steps: false,
    pavement_width: false,
    streetlights: false,
    surface_quality: false,
    gentle_slope: false,
    simple_navigation: false,
    rest_points: false,
    station_access: false,
    verified_reports: false,
    avoid_crash: false
  });
  const [sidebarOpen, setSidebarOpen] = useState(!isMobileViewport());

  // ── Navigation state ──────────────────────────────────────────────────────
  const [navActive, setNavActive]     = useState(false);
  const [simulating, setSimulating]   = useState(false);
  const [simPosition, setSimPosition] = useState(null);
  const [accessibleMode, setAccessibleMode] = useState(false);
  const [apiKey, setApiKey] = useState(() =>
    import.meta.env.VITE_ELEVENLABS_API_KEY ||
    localStorage.getItem('elevenlabs_api_key') ||
    ''
  );
  const [voiceId, setVoiceId] = useState(
    () => localStorage.getItem('elevenlabs_voice_id') || DEFAULT_VOICE_ID
  );

  // Simulation bookkeeping — use refs so the interval never closes over stale state
  const simIntervalRef  = useRef(null);
  const simCoordIdxRef  = useRef(0);
  const chosenRef       = useRef(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // GPS tracking — only active while navigating (no dependency on `chosen`)
  const { position: gpsPosition, gpsError } = useGpsTracking(navActive);

  // The position fed to the navigation engine: real GPS or simulated walk
  const effectivePosition = simPosition ?? gpsPosition;

  // ── Navigation handlers ────────────────────────────────────────────────────
  const startNavigation = useCallback(() => {
    setSidebarOpen(false);
    setNavActive(true);
  }, []);

  const endNavigation = useCallback(() => {
    setNavActive(false);
    setSimulating(false);
    setSimPosition(null);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    simCoordIdxRef.current = 0;
  }, []);

  const toggleSimulation = useCallback(() => {
    if (simulating) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
      setSimulating(false);
      setSimPosition(null);
      simCoordIdxRef.current = 0;
    } else {
      simCoordIdxRef.current = 0;
      setSimulating(true);
      // Tick every 300 ms — advances one route coord at a time
      simIntervalRef.current = setInterval(() => {
        const coords = chosenRef.current?.route?.coords;
        if (!coords) return;
        const idx = simCoordIdxRef.current;
        if (idx >= coords.length) {
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
          setSimulating(false);
          return;
        }
        const [lat, lng] = coords[idx];
        setSimPosition({ lat, lng, accuracy: 3 });
        simCoordIdxRef.current = idx + 1;
      }, 300);
    }
  }, [simulating]);

  const handleApiKeyChange = useCallback((key) => {
    setApiKey(key);
    localStorage.setItem('elevenlabs_api_key', key);
  }, []);

  const handleVoiceChange = useCallback((id) => {
    setVoiceId(id);
    localStorage.setItem('elevenlabs_voice_id', id);
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

  const computeRoute = async (startPoint, endPoint) => {
    if (!startPoint || !endPoint) return;
    if (samePoint(startPoint, endPoint)) {
      rejectSamePoint();
      clearRouteData();
      return;
    }

    const reqId = ++requestIdRef.current;
    const key = cacheKey(startPoint, endPoint);

    const cached = getCached(key);
    if (cached) {
      setRoutes(cached.routes);
      setAccData(cached.accData);
      setError(null);
      setWarning(cached.warning || null);
      return;
    }

    setLoading(true); setError(null); setWarning(null);
    try {
      const rs = await fetchRoutes(startPoint, endPoint);
      if (reqId !== requestIdRef.current) return;
      setRoutes(rs);
      const bbox = combinedBbox(rs);
      let nextAcc = EMPTY_ACC_DATA;
      let nextWarning = null;
      try {
        const data = await fetchAccessibilityData(bbox);
        if (reqId !== requestIdRef.current) return;
        nextAcc = data;
      } catch (e) {
        if (reqId !== requestIdRef.current) return;
        nextAcc = getDemoAccessibilityData(bbox);
        nextWarning = (
          'Using Belfast accessibility seed data because the OSM accessibility lookup is blocked or unreachable on this network. ' +
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

  const recommendedMode = useMemo(() => {
    return routeModes.find(m => m.id === selectedModeId)
      || routeModes.find(m => m.id === DEFAULT_ROUTE_MODE_ID)
      || routeModes[0]
      || null;
  }, [routeModes, selectedModeId]);

  const candidates = useMemo(() => {
    if (!recommendedMode || routeAnalyses.length === 0) return [];
    return routeAnalyses.map(a => scoreRouteAnalysis(a, recommendedMode.weights));
  }, [routeAnalyses, recommendedMode]);

  const recommendedIndex = recommendedMode?.routeIndex ?? -1;

  const chosenIndex = useMemo(() => {
    if (candidates.length === 0) return -1;
    if (selectedRouteIndex !== null && selectedRouteIndex >= 0 && selectedRouteIndex < candidates.length) {
      return selectedRouteIndex;
    }
    return recommendedIndex >= 0 ? recommendedIndex : 0;
  }, [candidates, selectedRouteIndex, recommendedIndex]);

  const chosen = chosenIndex >= 0 ? candidates[chosenIndex] : null;
  const selectedMode = recommendedMode;

  // Keep chosenRef in sync so the simulation interval never closes over stale chosen
  useEffect(() => { chosenRef.current = chosen ?? null; });

  // Derive navigation inputs from the chosen route
  const navSteps = useMemo(() => chosen?.route?.steps ?? [], [chosen]);
  const navEndCoord = useMemo(() => {
    const coords = chosen?.route?.coords;
    return coords?.length ? coords[coords.length - 1] : null;
  }, [chosen]);

  const {
    distanceToNext,
    currentInstruction,
    currentStep,
    arrived,
    updatePosition,
  } = useNavigation({
    steps:    navSteps,
    endCoord: navEndCoord,
    active:   navActive,
    apiKey,
    voiceId,
  });

  // Feed position updates into the navigation engine on every position change
  useEffect(() => {
    if (navActive && effectivePosition) updatePosition(effectivePosition);
  }, [effectivePosition, navActive, updatePosition]);

  useEffect(() => {
    setSelectedRouteIndex(null);
  }, [routes]);
  const allBlocked = routeAnalyses.length > 0 && routeAnalyses.every(route => route.blocked);
  const featureStats = useMemo(() => getFeatureStats(chosen), [chosen]);

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

  const candidateCount = candidates.filter(c => !c.blocked).length;
  const peekContent = loading ? (
    <div className="sheet-peek-summary muted">
      <div className="sheet-peek-time">Routing…</div>
      <div className="sheet-peek-meta">Finding accessible alternatives</div>
    </div>
  ) : chosen ? (() => {
    const sp = chosen.score != null ? Math.round(chosen.score * 100) : null;
    const spClass = sp == null ? '' : sp >= 68 ? 'good' : sp >= 42 ? 'warn' : 'red';
    return (
      <div className="sheet-peek-summary">
        <div className="sheet-peek-row">
          <div className="sheet-peek-time">{formatDuration(chosen.route.duration)}</div>
          {sp != null && (
            <span className={`peek-score-badge ${spClass}`} aria-label={`Accessibility score ${sp} out of 100`}>
              ♿ {sp}
            </span>
          )}
        </div>
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
    );
  })() : (
    <div className="sheet-peek-summary muted">
      <div className="sheet-peek-time">No route yet</div>
      <div className="sheet-peek-meta">{hint || 'Pick a start and destination'}</div>
    </div>
  );

  return (
    <div className={`app${sidebarOpen ? ' sheet-open' : ' sheet-peek'}${navActive ? ' nav-active' : ''}`}>
      <JourneyMap
        hint={navActive ? null : hint}
        loading={loading}
        start={start}
        end={end}
        scored={routeAnalyses}
        chosen={chosen}
        chosenIndex={chosenIndex}
        onMapClick={navActive ? undefined : handleMapClick}
        userPosition={effectivePosition}
        followUser={navActive}
      />

      {/* ── Navigation HUD (shown when navigating) ─────────────────────── */}
      {navActive && (
        <NavigationHud
          instruction={currentInstruction}
          distanceToNext={distanceToNext}
          currentStep={currentStep}
          arrived={arrived}
          simulating={simulating}
          gpsError={gpsError}
          accessible={accessibleMode}
          apiKey={apiKey}
          voiceId={voiceId}
          onEnd={endNavigation}
          onToggleSimulate={toggleSimulation}
          onApiKeyChange={handleApiKeyChange}
          onVoiceChange={handleVoiceChange}
        />
      )}

      {/* Hide the directions card during active navigation — the HUD takes over */}
      <div className={`top-card${navActive ? ' top-card--hidden' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark" aria-hidden="true">🦮</span>
          <span className="brand-title">SafeStep · Belfast</span>
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
        {/* Start Navigation — visible when a route is ready and not yet navigating */}
        {chosen && !navActive && (
          <button
            type="button"
            className="fab fab-nav"
            onClick={startNavigation}
            aria-label="Start navigation"
            title="Start navigation"
          >
            <span aria-hidden="true">▶</span>
          </button>
        )}
        {/* Accessibility mode toggle */}
        <button
          type="button"
          className={`fab${accessibleMode ? ' fab-active' : ''}`}
          onClick={() => setAccessibleMode(m => !m)}
          aria-label={accessibleMode ? 'Disable accessibility mode' : 'Enable accessibility mode'}
          title="Accessibility mode"
        >
          <span aria-hidden="true">♿</span>
        </button>
        <button
          type="button"
          className="fab"
          onClick={navActive ? endNavigation : reset}
          disabled={!navActive && !start && !end}
          aria-label={navActive ? 'End navigation' : 'Clear points'}
          title={navActive ? 'End' : 'Clear'}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <BottomSheet
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        peek={peekContent}
      >
        <RouteModeCards
          candidates={candidates}
          modes={routeModes}
          recommendedIndex={recommendedIndex}
          selectedIndex={chosenIndex}
          activeModeId={selectedMode?.id || selectedModeId}
          onSelectRoute={setSelectedRouteIndex}
          onSelectMode={(id) => { setSelectedModeId(id); setSelectedRouteIndex(null); }}
        />
        <PreferenceList
          filters={filters}
          filterOptions={FILTERS}
          onChange={(id, checked) => {
            setFilters(prev => ({ ...prev, [id]: checked }));
            setSelectedRouteIndex(null);
          }}
        />
        <RouteDetails chosen={chosen} selectedMode={selectedMode} featureStats={featureStats} filters={filters} />
        <MapLegend />
        <p className="footnote">
          Fastest = shortest walk. Balanced applies lighter accessibility weighting. Beacon Accessible uses the full preference set. Crossing data comes from OSM tags within 30 m of the route. The wider score model can also use nearby steps, pavement width, lighting, surface, gradient, support places, station access, and seeded community reports where known. Unknown data stays unknown rather than being treated as missing.
        </p>
      </BottomSheet>
    </div>
  );
}
