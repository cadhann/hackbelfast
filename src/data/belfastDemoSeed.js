export const BELFAST_DEMO_SOURCE = 'belfast_demo_seed';

export const BELFAST_DEMO_LANDMARKS = [
  {
    id: 'grand-opera-house',
    name: 'Grand Opera House',
    type: 'Venue',
    area: 'Great Victoria Street',
    lat: 54.5941,
    lng: -5.9347,
    aliases: ['opera house', 'great victoria street']
  },
  {
    id: 'victoria-square',
    name: 'Victoria Square',
    type: 'Shopping / Landmark',
    area: 'Victoria Street',
    lat: 54.5993,
    lng: -5.9254,
    aliases: ['dome', 'shopping centre', 'victoria square dome']
  },
  {
    id: 'st-annes-cathedral',
    name: "St Anne's Cathedral",
    type: 'Landmark',
    area: 'Cathedral Quarter',
    lat: 54.6022,
    lng: -5.9286,
    aliases: ['cathedral', 'cathedral quarter']
  },
  {
    id: 'ulster-university-belfast',
    name: 'Ulster University Belfast',
    type: 'Campus',
    area: 'York Street',
    lat: 54.6037,
    lng: -5.9264,
    aliases: ['ulster university', 'uu belfast', 'york street']
  },
  {
    id: 'castlecourt',
    name: 'CastleCourt',
    type: 'Shopping',
    area: 'Royal Avenue',
    lat: 54.6008,
    lng: -5.9313,
    aliases: ['castle court', 'royal avenue']
  },
  {
    id: 'botanic-station',
    name: 'Botanic Station',
    type: 'Station',
    area: 'Botanic Avenue',
    lat: 54.5870,
    lng: -5.9307,
    aliases: ['botanic train station']
  },
  {
    id: 'royal-victoria-hospital',
    name: 'Royal Victoria Hospital',
    type: 'Hospital',
    area: 'Grosvenor Road',
    lat: 54.5881,
    lng: -5.9561,
    aliases: ['rvh', 'royal hospital']
  },
  {
    id: 'belfast-met-titanic-quarter',
    name: 'Belfast Met Titanic Quarter',
    type: 'Campus',
    area: 'Queen\'s Road',
    lat: 54.6086,
    lng: -5.9118,
    aliases: ['belfast met', 'titanic campus']
  }
];

export const BELFAST_DEMO_ACCESSIBILITY_NODES = [
  {
    id: 'seed-city-hall-west-crossing',
    lat: 54.59645,
    lon: -5.93125,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      'traffic_signals:sound': 'yes',
      kerb: 'lowered',
      name: 'Donegall Square West crossing',
      area: 'City Hall',
      demo_note: 'Seed note: City Hall west side has tactile paving, lowered kerbs, and an audible signal in the demo data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-city-hall-east-crossing',
    lat: 54.59656,
    lon: -5.92876,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      kerb: 'lowered',
      name: 'Donegall Square East crossing',
      area: 'City Hall',
      demo_note: 'Seed note: tactile paving and lowered kerbs are present around the east side of City Hall.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-grand-central-howard-crossing',
    lat: 54.59480,
    lon: -5.93480,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'no',
      'traffic_signals:sound': 'no',
      kerb: 'raised',
      name: 'Howard Street / Great Victoria Street crossing',
      area: 'Grand Central',
      demo_issue: 'Issue example: a wide, busy crossing near the transport hub with missing tactile and audio cues in the seed data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-great-victoria-grosvenor-crossing',
    lat: 54.59295,
    lon: -5.93655,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      'traffic_signals:sound': 'no',
      kerb: 'lowered',
      name: 'Great Victoria Street / Grosvenor Road crossing',
      area: 'Weavers Cross',
      demo_issue: 'Issue example: long signal phases and bus movements make this a caution point even with tactile paving.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-shaftesbury-square-crossing',
    lat: 54.58860,
    lon: -5.93220,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'no',
      kerb: 'raised',
      name: 'Shaftesbury Square crossing',
      area: 'Dublin Road',
      demo_issue: 'Issue example: multi-arm junction with a raised kerb and missing tactile paving in the seed data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-queens-main-gate-crossing',
    lat: 54.58455,
    lon: -5.93455,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      kerb: 'flush',
      name: "Queen's University main gate crossing",
      area: "Queen's Quarter",
      demo_note: 'Seed note: flush kerbs and tactile paving are marked at the University Road crossing.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-botanic-university-road-crossing',
    lat: 54.58730,
    lon: -5.93110,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      'traffic_signals:sound': 'no',
      kerb: 'lowered',
      name: 'Botanic Avenue / University Road crossing',
      area: 'Botanic',
      demo_issue: 'Issue example: tactile paving is present, but audio cues are absent in the seed data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-st-georges-oxford-crossing',
    lat: 54.59585,
    lon: -5.92295,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      'traffic_signals:sound': 'yes',
      kerb: 'lowered',
      name: "St George's Market crossing",
      area: 'Oxford Street',
      demo_note: 'Seed note: market-side crossing has tactile paving, lowered kerbs, and an audible signal in the demo data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-lanyon-east-bridge-crossing',
    lat: 54.59508,
    lon: -5.91810,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'no',
      kerb: 'raised',
      name: 'Lanyon Place / East Bridge Street crossing',
      area: 'Lanyon Place',
      demo_issue: 'Issue example: busy bridge approach with raised kerb and missing tactile paving in the seed data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-queens-bridge-crossing',
    lat: 54.59825,
    lon: -5.91710,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      'traffic_signals:sound': 'no',
      kerb: 'lowered',
      name: "Queen's Bridge approach crossing",
      area: 'River Lagan',
      demo_issue: 'Issue example: exposed bridge approach where audio cues are not marked in the seed data.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-titanic-queens-road-crossing',
    lat: 54.60685,
    lon: -5.91095,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      kerb: 'lowered',
      name: "Queen's Road crossing",
      area: 'Titanic Quarter',
      demo_note: 'Seed note: wide Titanic Quarter crossing with tactile paving and lowered kerbs.',
      source: BELFAST_DEMO_SOURCE
    }
  },
  {
    id: 'seed-sse-arena-crossing',
    lat: 54.60280,
    lon: -5.91380,
    tags: {
      highway: 'crossing',
      crossing: 'traffic_signals',
      tactile_paving: 'yes',
      kerb: 'lowered',
      name: 'SSE Arena approach crossing',
      area: 'Titanic Quarter',
      demo_note: 'Seed note: arena approach crossing has tactile paving and lowered kerbs in the demo data.',
      source: BELFAST_DEMO_SOURCE
    }
  }
];

export const BELFAST_DEMO_BUSY_WAYS = [
  {
    id: 'seed-way-great-victoria-street',
    tags: {
      highway: 'primary',
      name: 'Great Victoria Street',
      demo_issue: 'Difficult junction: bus and general traffic movements around Grand Central.',
      source: BELFAST_DEMO_SOURCE
    },
    geometry: [
      { lat: 54.59260, lon: -5.93720 },
      { lat: 54.59440, lon: -5.93540 },
      { lat: 54.59600, lon: -5.93380 }
    ]
  },
  {
    id: 'seed-way-east-bridge-street',
    tags: {
      highway: 'primary',
      name: 'East Bridge Street',
      demo_issue: 'Difficult junction: fast bridge approach between Lanyon Place and the city centre.',
      source: BELFAST_DEMO_SOURCE
    },
    geometry: [
      { lat: 54.59460, lon: -5.91950 },
      { lat: 54.59520, lon: -5.91760 },
      { lat: 54.59620, lon: -5.91600 }
    ]
  },
  {
    id: 'seed-way-oxford-street',
    tags: {
      highway: 'primary',
      name: 'Oxford Street',
      demo_issue: "Difficult junction: market, bridge, and Waterfront movements concentrate around St George's.",
      source: BELFAST_DEMO_SOURCE
    },
    geometry: [
      { lat: 54.59530, lon: -5.92380 },
      { lat: 54.59640, lon: -5.92100 },
      { lat: 54.59770, lon: -5.91800 }
    ]
  },
  {
    id: 'seed-way-queens-road',
    tags: {
      highway: 'secondary',
      name: "Queen's Road",
      demo_issue: 'Difficult junction: wide Titanic Quarter crossings with long exposed walking distances.',
      source: BELFAST_DEMO_SOURCE
    },
    geometry: [
      { lat: 54.60270, lon: -5.91400 },
      { lat: 54.60560, lon: -5.91220 },
      { lat: 54.60810, lon: -5.90990 }
    ]
  },
  {
    id: 'seed-way-dublin-road',
    tags: {
      highway: 'primary',
      name: 'Dublin Road',
      demo_issue: 'Difficult junction: Shaftesbury Square has multiple arms and heavy turning movements.',
      source: BELFAST_DEMO_SOURCE
    },
    geometry: [
      { lat: 54.58690, lon: -5.93180 },
      { lat: 54.58870, lon: -5.93220 },
      { lat: 54.59100, lon: -5.93270 }
    ]
  }
];

function pointInsideBbox(lat, lon, bbox) {
  const [s, w, n, e] = bbox;
  return lat >= s && lat <= n && lon >= w && lon <= e;
}

function wayInsideBbox(way, bbox) {
  return way.geometry.some(point => pointInsideBbox(point.lat, point.lon, bbox));
}

function dedupeById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getDemoAccessibilityData(bbox) {
  return {
    nodes: BELFAST_DEMO_ACCESSIBILITY_NODES.filter(node => pointInsideBbox(node.lat, node.lon, bbox)),
    busyWays: BELFAST_DEMO_BUSY_WAYS.filter(way => wayInsideBbox(way, bbox)),
    forbiddenWays: [],
    source: BELFAST_DEMO_SOURCE,
    seedOnly: true
  };
}

export function mergeDemoAccessibilityData(data, bbox) {
  const demo = getDemoAccessibilityData(bbox);
  return {
    nodes: dedupeById([...(data.nodes || []), ...demo.nodes]),
    busyWays: dedupeById([...(data.busyWays || []), ...demo.busyWays]),
    forbiddenWays: dedupeById([...(data.forbiddenWays || []), ...demo.forbiddenWays]),
    source: data.source ? `${data.source} + ${BELFAST_DEMO_SOURCE}` : BELFAST_DEMO_SOURCE,
    seedOnly: false
  };
}
