import { BELFAST_DEMO_LANDMARKS } from './belfastDemoSeed';

export const DESTINATIONS = [
  {
    id: 'grand-central',
    name: 'Belfast Grand Central Station',
    type: 'Station',
    area: 'Weavers Cross',
    lat: 54.5946,
    lng: -5.9367,
    aliases: ['europa', 'buscentre', 'transport hub']
  },
  {
    id: 'city-hall',
    name: 'Belfast City Hall',
    type: 'Landmark',
    area: 'Donegall Square',
    lat: 54.5964,
    lng: -5.9300,
    aliases: ['donegall square']
  },
  {
    id: 'lanyon-place',
    name: 'Lanyon Place Station',
    type: 'Station',
    area: 'East Bridge Street',
    lat: 54.5951,
    lng: -5.9174,
    aliases: ['central station', 'train station']
  },
  {
    id: 'queens-university',
    name: "Queen's University Belfast",
    type: 'Campus',
    area: 'University Road',
    lat: 54.5844,
    lng: -5.9342,
    aliases: ['qub', 'queens']
  },
  {
    id: 'ulster-hall',
    name: 'Ulster Hall',
    type: 'Venue',
    area: 'Bedford Street',
    lat: 54.5949,
    lng: -5.9309,
    aliases: ['concert hall']
  },
  {
    id: 'waterfront-hall',
    name: 'Waterfront Hall',
    type: 'Venue',
    area: 'Lanyon Place',
    lat: 54.5962,
    lng: -5.9191,
    aliases: ['icc belfast']
  },
  {
    id: 'sse-arena',
    name: 'SSE Arena Belfast',
    type: 'Venue',
    area: 'Titanic Quarter',
    lat: 54.6031,
    lng: -5.9143,
    aliases: ['arena', 'odyssey']
  },
  {
    id: 'titanic-belfast',
    name: 'Titanic Belfast',
    type: 'Visitor attraction',
    area: 'Titanic Quarter',
    lat: 54.6081,
    lng: -5.9097,
    aliases: ['titanic museum']
  },
  {
    id: 'st-georges-market',
    name: "St George's Market",
    type: 'Market',
    area: 'Oxford Street',
    lat: 54.5960,
    lng: -5.9235,
    aliases: ['market']
  },
  {
    id: 'botanic-gardens',
    name: 'Botanic Gardens',
    type: 'Park',
    area: 'Queen’s Quarter',
    lat: 54.5827,
    lng: -5.9334,
    aliases: ['botanic park']
  },
  ...BELFAST_DEMO_LANDMARKS
];
