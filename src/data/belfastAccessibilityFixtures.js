export const BELFAST_CIVIC_FIXTURE_SOURCE = 'belfast_civic_seed';
export const BELFAST_COMMUNITY_REPORT_SOURCE = 'belfast_community_seed';

export const BELFAST_TOILETS = [
  {
    id: 'seed-city-hall-toilets',
    lat: 54.59630,
    lon: -5.93002,
    tags: {
      amenity: 'toilets',
      name: 'City Hall public toilets',
      area: 'Donegall Square',
      wheelchair: 'yes',
      'toilets:wheelchair': 'yes',
      opening_hours: 'Mo-Sa 09:00-17:00',
      fixture_note: 'Accessible toilet inside City Hall during staffed opening hours.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-victoria-square-toilets',
    lat: 54.59922,
    lon: -5.92552,
    tags: {
      amenity: 'toilets',
      name: 'Victoria Square toilets',
      area: 'Victoria Square',
      wheelchair: 'yes',
      'toilets:wheelchair': 'yes',
      opening_hours: 'Mo-Su 09:00-21:00',
      fixture_note: 'Shopping-centre toilets with step-free lift access in the demo data.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-lanyon-place-toilets',
    lat: 54.59618,
    lon: -5.91864,
    tags: {
      amenity: 'toilets',
      name: 'Lanyon Place station toilets',
      area: 'Lanyon Place',
      wheelchair: 'yes',
      'toilets:wheelchair': 'yes',
      opening_hours: 'Mo-Su 06:00-22:30',
      fixture_note: 'Station toilets near the concourse with an accessible cubicle in the demo data.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  }
];

export const BELFAST_SEATING = [
  {
    id: 'seed-city-hall-east-benches',
    lat: 54.59692,
    lon: -5.92942,
    tags: {
      amenity: 'bench',
      name: 'City Hall east benches',
      area: 'Donegall Square',
      backrest: 'yes',
      fixture_note: 'Frequent seating beside the City Hall paths and lawns.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-custom-house-square-seating',
    lat: 54.60160,
    lon: -5.92190,
    tags: {
      amenity: 'bench',
      name: 'Custom House Square seating',
      area: 'Custom House Square',
      backrest: 'yes',
      fixture_note: 'Open square with seating useful as a pause point between Cathedral Quarter and Lanyon Place.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-botanic-gardens-benches',
    lat: 54.58590,
    lon: -5.93152,
    tags: {
      amenity: 'bench',
      name: 'Botanic Gardens benches',
      area: 'Botanic',
      backrest: 'yes',
      fixture_note: 'Park-side seating close to Botanic Avenue and Queen\'s University approaches.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-titanic-slipways-seating',
    lat: 54.60806,
    lon: -5.91082,
    tags: {
      amenity: 'bench',
      name: 'Titanic Slipways seating',
      area: 'Titanic Quarter',
      backrest: 'yes',
      fixture_note: 'Promenade seating on the Titanic Quarter approach.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  }
];

export const BELFAST_STATIONS = [
  {
    id: 'seed-grand-central-station-access',
    lat: 54.59476,
    lon: -5.93498,
    tags: {
      railway: 'station',
      public_transport: 'station',
      name: 'Grand Central Station accessible entrance',
      area: 'Weavers Cross',
      wheelchair: 'yes',
      step_free: 'yes',
      lift: 'yes',
      assistance: 'yes',
      tactile_paving: 'yes',
      'toilets:wheelchair': 'yes',
      fixture_note: 'Main concourse entrance with lifts, tactile routes, and staffed assistance in the demo data.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-lanyon-place-station-access',
    lat: 54.59608,
    lon: -5.91822,
    tags: {
      railway: 'station',
      public_transport: 'station',
      name: 'Lanyon Place accessible entrance',
      area: 'Lanyon Place',
      wheelchair: 'yes',
      step_free: 'yes',
      lift: 'yes',
      assistance: 'yes',
      tactile_paving: 'yes',
      'toilets:wheelchair': 'yes',
      fixture_note: 'Step-free station entrance with lift access to platforms in the demo data.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  },
  {
    id: 'seed-botanic-station-access',
    lat: 54.58706,
    lon: -5.93072,
    tags: {
      railway: 'station',
      public_transport: 'station',
      name: 'Botanic Station accessible entrance',
      area: 'Botanic',
      wheelchair: 'limited',
      step_free: 'partial',
      lift: 'no',
      assistance: 'check_ahead',
      tactile_paving: 'yes',
      fixture_note: 'Route to the platforms should be checked ahead; the demo seed marks this stop as only partly step-free.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    }
  }
];

export const BELFAST_COMMUNITY_REPORTS = [
  {
    id: 'seed-report-grand-central-obstruction',
    lat: 54.59488,
    lon: -5.93474,
    category: 'obstruction',
    severity: 'high',
    status: 'open',
    verification: 'verified',
    freshness: 'recent',
    reportedAt: '2026-04-22',
    verifiedAt: '2026-04-24',
    summary: 'Temporary barriers are narrowing the dropped-kerb approach on Howard Street.',
    tags: {
      name: 'Grand Central kerb narrowed by temporary barriers',
      report_category: 'obstruction',
      report_severity: 'high',
      report_status: 'open',
      report_verification: 'verified',
      report_freshness: 'recent',
      reported_at: '2026-04-22',
      verified_at: '2026-04-24',
      fixture_note: 'Community report: temporary barriers are narrowing the dropped-kerb approach on Howard Street.',
      source: BELFAST_COMMUNITY_REPORT_SOURCE
    }
  },
  {
    id: 'seed-report-shaftesbury-surface',
    lat: 54.58855,
    lon: -5.93205,
    category: 'surface',
    severity: 'medium',
    status: 'monitoring',
    verification: 'reported',
    freshness: 'stale',
    reportedAt: '2026-03-11',
    verifiedAt: null,
    summary: 'Users reported broken paving and ponding near the multi-arm junction.',
    tags: {
      name: 'Broken paving near Shaftesbury Square',
      report_category: 'surface',
      report_severity: 'medium',
      report_status: 'monitoring',
      report_verification: 'reported',
      report_freshness: 'stale',
      reported_at: '2026-03-11',
      fixture_note: 'Community report: uneven paving and ponding were reported near the Shaftesbury Square crossings.',
      source: BELFAST_COMMUNITY_REPORT_SOURCE
    }
  },
  {
    id: 'seed-report-lanyon-audio',
    lat: 54.59506,
    lon: -5.91802,
    category: 'crossing',
    severity: 'medium',
    status: 'open',
    verification: 'verified',
    freshness: 'recent',
    reportedAt: '2026-04-16',
    verifiedAt: '2026-04-20',
    summary: 'Audible crossing cues were reported as unreliable on the bridge approach.',
    tags: {
      name: 'Lanyon Place audible cues unreliable',
      report_category: 'crossing',
      report_severity: 'medium',
      report_status: 'open',
      report_verification: 'verified',
      report_freshness: 'recent',
      reported_at: '2026-04-16',
      verified_at: '2026-04-20',
      fixture_note: 'Community report: audible cues were reported as inconsistent on the bridge-side crossing approach.',
      source: BELFAST_COMMUNITY_REPORT_SOURCE
    }
  },
  {
    id: 'seed-report-cathedral-lighting',
    lat: 54.60210,
    lon: -5.92896,
    category: 'lighting',
    severity: 'low',
    status: 'monitoring',
    verification: 'reported',
    freshness: 'recent',
    reportedAt: '2026-04-14',
    verifiedAt: null,
    summary: 'Evening lighting felt patchy on the cobbled cut-through toward St Anne\'s Square.',
    tags: {
      name: 'Cathedral Quarter evening lighting concern',
      report_category: 'lighting',
      report_severity: 'low',
      report_status: 'monitoring',
      report_verification: 'reported',
      report_freshness: 'recent',
      reported_at: '2026-04-14',
      fixture_note: 'Community report: evening lighting felt patchy on the cobbled cut-through toward St Anne\'s Square.',
      source: BELFAST_COMMUNITY_REPORT_SOURCE
    }
  }
];

export const BELFAST_ROUGH_WAYS = [
  {
    id: 'seed-surface-commercial-court',
    tags: {
      highway: 'pedestrian',
      name: 'Commercial Court setts',
      area: 'Cathedral Quarter',
      surface: 'sett',
      smoothness: 'bad',
      surface_quality: 'rough',
      fixture_note: 'Historic setts and joints can feel uneven underfoot and with some mobility aids.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.60200, lon: -5.92938 },
      { lat: 54.60216, lon: -5.92888 },
      { lat: 54.60228, lon: -5.92830 }
    ]
  },
  {
    id: 'seed-surface-botanic-paving',
    tags: {
      highway: 'footway',
      name: 'Botanic Avenue paving',
      area: 'Botanic',
      surface: 'paving_stones',
      smoothness: 'intermediate',
      surface_quality: 'mixed',
      fixture_note: 'Older paving slabs on the Botanic Avenue approach create a mixed surface in the demo seed.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.58692, lon: -5.93178 },
      { lat: 54.58742, lon: -5.93112 },
      { lat: 54.58796, lon: -5.93054 }
    ]
  },
  {
    id: 'seed-surface-lanyon-bridge-joints',
    tags: {
      highway: 'footway',
      name: 'Lanyon bridge joints',
      area: 'Lanyon Place',
      surface: 'paving_stones',
      smoothness: 'bad',
      surface_quality: 'rough',
      fixture_note: 'Bridge approach joints and patch repairs create a rougher walking line in the demo seed.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.59500, lon: -5.91904 },
      { lat: 54.59530, lon: -5.91834 },
      { lat: 54.59558, lon: -5.91762 }
    ]
  }
];

export const BELFAST_STEEP_WAYS = [
  {
    id: 'seed-slope-rvh-approach',
    tags: {
      highway: 'footway',
      name: 'Royal Victoria Hospital uphill approach',
      area: 'Grosvenor Road',
      incline: '8%',
      slope_class: 'steep',
      fixture_note: 'Noticeable uphill pull toward the hospital entrances.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.58718, lon: -5.95492 },
      { lat: 54.58760, lon: -5.95542 },
      { lat: 54.58808, lon: -5.95596 }
    ]
  },
  {
    id: 'seed-slope-donegall-pass-link',
    tags: {
      highway: 'footway',
      name: 'Donegall Pass rise',
      area: 'Dublin Road',
      incline: '5%',
      slope_class: 'moderate',
      fixture_note: 'Gentle but sustained incline on the Donegall Pass link toward the city centre.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.58984, lon: -5.92892 },
      { lat: 54.59104, lon: -5.92948 },
      { lat: 54.59212, lon: -5.93016 }
    ]
  },
  {
    id: 'seed-slope-cathedral-quarter-ramp',
    tags: {
      highway: 'footway',
      name: 'Cathedral Quarter ramp',
      area: 'Cathedral Quarter',
      incline: '6%',
      slope_class: 'moderate',
      fixture_note: 'Short ramped section on the north-side approach to St Anne\'s Square.',
      source: BELFAST_CIVIC_FIXTURE_SOURCE
    },
    geometry: [
      { lat: 54.60234, lon: -5.92958 },
      { lat: 54.60274, lon: -5.92902 },
      { lat: 54.60306, lon: -5.92846 }
    ]
  }
];
