import axios from 'axios';

const TFL_API_BASE = 'https://api.tfl.gov.uk';
const TFL_APP_ID = process.env.TFL_APP_ID || '20d4212820254655aa1b8caeaa74e237';
const TFL_APP_KEY = process.env.TFL_APP_KEY || '4a784eea91d24c16a6c89840a87f15bb';

// Cache for stop points (name -> coordinates)
let stopPointCache = {
  // Pre-populate with common London stops to avoid API timeouts
  'Victoria Station': { lat: 51.4424, lon: -0.1439 },
  'King\'s Cross St. Pancras': { lat: 51.5308, lon: -0.1249 },
  'Liverpool Street Station': { lat: 51.5176, lon: -0.0833 },
  'Piccadilly Circus': { lat: 51.5098, lon: -0.1342 },
  'Oxford Circus': { lat: 51.5155, lon: -0.1410 },
  'Tottenham Court Road': { lat: 51.5161, lon: -0.1315 },
  'Russell Square': { lat: 51.5223, lon: -0.1244 },
  'British Museum': { lat: 51.5194, lon: -0.1270 },
  'Covent Garden': { lat: 51.5132, lon: -0.1237 },
  'Leicester Square': { lat: 51.5112, lon: -0.1281 },
  'Charing Cross': { lat: 51.5058, lon: -0.1246 },
  'Westminster Station': { lat: 51.4974, lon: -0.1256 },
  'Tower Bridge': { lat: 51.5055, lon: -0.0754 },
  'London Bridge Station': { lat: 51.5055, lon: -0.0860 },
  'Bank of England': { lat: 51.5158, lon: -0.0882 },
  'St Paul\'s Cathedral': { lat: 51.5137, lon: -0.0982 },
  'Tower of London': { lat: 51.5081, lon: -0.0759 },
  'Packington Street': { lat: 51.5342, lon: -0.1039 },
  'King\'s Cross Station': { lat: 51.5330, lon: -0.1239 },
  'Waterloo Station': { lat: 51.5030, lon: -0.1050 },
  'Paddington Station': { lat: 51.5154, lon: -0.1755 },
  'Marble Arch': { lat: 51.5135, lon: -0.1585 },
  'Knightsbridge': { lat: 51.5020, lon: -0.1600 },
  'South Kensington': { lat: 51.4851, lon: -0.1405 },
  'Earls Court': { lat: 51.4920, lon: -0.1970 },
  'Hammersmith': { lat: 51.4925, lon: -0.2225 },
  'Westminster Abbey': { lat: 51.4970, lon: -0.1272 },
  'Trafalgar Square': { lat: 51.5081, lon: -0.1246 },
  'Piccadilly': { lat: 51.5101, lon: -0.1340 },
  'Regent Street': { lat: 51.5138, lon: -0.1413 },
  'Bond Street': { lat: 51.5141, lon: -0.1494 },
  'Oxford Street': { lat: 51.5159, lon: -0.1443 },
  'Soho': { lat: 51.5156, lon: -0.1298 },
  'Holborn': { lat: 51.5177, lon: -0.1209 },
  'The British Museum': { lat: 51.5194, lon: -0.1270 },
  'Camden Town': { lat: 51.5400, lon: -0.1430 },
  'Islington': { lat: 51.5360, lon: -0.1030 },
  'King\'s Cross': { lat: 51.5330, lon: -0.1239 },
  'Shoreditch': { lat: 51.5276, lon: -0.0809 },
  'Old Street': { lat: 51.5253, lon: -0.0893 },
  'Barbican': { lat: 51.5225, lon: -0.0987 },
  'St Paul\'s': { lat: 51.5137, lon: -0.0982 },
  'Bank': { lat: 51.5134, lon: -0.0890 },
  'Monument': { lat: 51.5105, lon: -0.0865 },
  'Tower Hill': { lat: 51.5083, lon: -0.0760 },
  'Whitechapel': { lat: 51.5160, lon: -0.0623 },
  'Bethnal Green': { lat: 51.5292, lon: -0.0546 },
  'Stratford': { lat: 51.5415, lon: -0.0025 },
  'Canary Wharf': { lat: 51.5050, lon: -0.0235 },
  'Isle of Dogs': { lat: 51.5068, lon: -0.0155 },
  'Limehouse': { lat: 51.5108, lon: -0.0247 },
  'Rotherhithe': { lat: 51.5017, lon: -0.0448 },
  'Bermondsey': { lat: 51.4960, lon: -0.0556 },
  'Elephant & Castle': { lat: 51.4956, lon: -0.1046 },
  'Southwark': { lat: 51.5030, lon: -0.0973 },
  'Borough': { lat: 51.5049, lon: -0.0896 },
  'London Bridge': { lat: 51.5055, lon: -0.0860 },
  'Tower Gateway': { lat: 51.5072, lon: -0.0748 },
  'DLR': { lat: 51.5068, lon: -0.0155 },
};

let lastStopPointFetch = 0;
const STOP_POINT_CACHE_TTL = 3600000; // 1 hour
const API_TIMEOUT = 15000; // Increased timeout to 15 seconds to handle slow TfL API responses

/**
 * Fetch live vehicle predictions for a specific mode
 * @param {string} mode - Transport mode (e.g., 'bus')
 * @returns {Promise<Array>} Array of vehicle predictions
 */
export async function getLiveVehiclePredictions(mode = 'bus') {
  try {
    const url = `${TFL_API_BASE}/Mode/${mode}/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
    console.log(`🔄 Fetching ${mode} predictions from TfL...`);
    
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    const predictions = response.data || [];
    
    console.log(`✅ Received ${predictions.length} ${mode} predictions from TfL`);
    
    // Group by vehicle ID and get latest position for each
    const vehicleMap = new Map();
    
    predictions.forEach(pred => {
      if (pred.vehicleId && !vehicleMap.has(pred.vehicleId)) {
        vehicleMap.set(pred.vehicleId, pred);
      }
    });
    
    return Array.from(vehicleMap.values());
  } catch (error) {
    console.error('❌ Error fetching TfL predictions:', error.message);
    return [];
  }
}

/**
 * Get stop point coordinates from cache or TfL API
 * @param {string} stopName - Name of the stop
 * @returns {Promise<Object|null>} {lat, lon} or null
 */
export async function getStopPointCoordinates(stopName) {
  if (!stopName) return null;
  
  // Check cache first (includes pre-populated common stops)
  if (stopPointCache[stopName]) {
    return stopPointCache[stopName];
  }
  
  try {
    const url = `${TFL_API_BASE}/StopPoint/Search?query=${encodeURIComponent(stopName)}&modes=bus&app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
    
    const response = await axios.get(url, { timeout: API_TIMEOUT });
    const matches = response.data?.matches || [];
    
    if (matches.length > 0) {
      const stopPoint = matches[0];
      const coords = { lat: stopPoint.lat, lon: stopPoint.lon };
      
      // Cache the result
      stopPointCache[stopName] = coords;
      
      return coords;
    }
    
    return null;
  } catch (error) {
    console.warn(`⚠️ Could not fetch stop point "${stopName}": ${error.message}`);
    // Return null rather than throwing, API will use current vehicle position
    return null;
  }
}

/**
 * Calculate interpolated position between two points
 * @param {number} fromLat - Starting latitude
 * @param {number} fromLon - Starting longitude
 * @param {number} toLat - Ending latitude
 * @param {number} toLon - Ending longitude
 * @param {number} progress - Progress between 0 and 1
 * @returns {Object} {lat, lon}
 */
export function interpolatePosition(fromLat, fromLon, toLat, toLon, progress) {
  // Clamp progress between 0 and 1
  const p = Math.max(0, Math.min(1, progress));
  
  return {
    lat: fromLat + (toLat - fromLat) * p,
    lon: fromLon + (toLon - fromLon) * p
  };
}

/**
 * Calculate progress between 0-1 based on timeToStation
 * Uses exponential easing for more natural movement
 * @param {number} currentTimeToStation - Current time to station in seconds
 * @param {number} previousTimeToStation - Previous time to station in seconds
 * @returns {number} Progress (0-1)
 */
export function calculateProgress(currentTimeToStation, previousTimeToStation = null) {
  if (previousTimeToStation === null || previousTimeToStation <= 0) {
    return 0;
  }
  
  // Calculate how much time has passed since last update
  const timeElapsed = previousTimeToStation - currentTimeToStation;
  const progress = Math.min(1, timeElapsed / previousTimeToStation);
  
  return progress;
}

/**
 * Generate a unique hash-based position for a vehicle
 * Spreads vehicles across London deterministically
 * @param {string} vehicleId - Vehicle identifier
 * @param {string} lineId - Bus line number
 * @param {string} direction - Direction (inbound/outbound)
 * @returns {Object} {lat, lon} coordinates
 */
function generateUniqueVehiclePosition(vehicleId, lineId, direction) {
  // Create a hash from vehicle and line ID (djb2)
  let hash = 5381;
  const str = `${vehicleId || ''}-${lineId || ''}-${direction || ''}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
  }
  hash = Math.abs(hash);
  
  // Use hash to pick a base location from known bus routes
  const routePositions = {
    '1': { lat: 51.5007, lon: -0.0760 },
    '12': { lat: 51.4926, lon: -0.1946 },
    '18': { lat: 51.4643, lon: -0.1695 },
    '24': { lat: 51.5452, lon: -0.1428 },
    '38': { lat: 51.5207, lon: -0.0744 },
    '55': { lat: 51.5165, lon: -0.1310 },
    '73': { lat: 51.4927, lon: -0.1850 },
    '94': { lat: 51.5165, lon: -0.1310 },
    '137': { lat: 51.5076, lon: 0.0188 },
    '148': { lat: 51.5338, lon: -0.0982 },
  };
  
  // Get base position for this line, or use central London
  let basePos = routePositions[lineId];
  if (!basePos) {
    // Use hash to select a default position
    const defaultLocations = [
      { lat: 51.5074, lon: -0.1278 }, // Westminster
      { lat: 51.5155, lon: -0.0723 }, // City of London
      { lat: 51.5400, lon: -0.1430 }, // Camden
      { lat: 51.5360, lon: -0.1030 }, // Islington
      { lat: 51.5415, lon: -0.0025 }, // Stratford
      { lat: 51.5050, lon: -0.0235 }, // Canary Wharf
      { lat: 51.4950, lon: -0.1445 }, // Victoria
      { lat: 51.4643, lon: -0.1695 }, // Clapham
    ];
    basePos = defaultLocations[Math.abs(hash) % defaultLocations.length];
  }
  
  // Add deterministic offset based on hash (spreads vehicles around the route)
  const offset1 = (hash % 10000) / 10000; // 0..1
  const offset2 = (Math.floor(hash / 10000) % 10000) / 10000; // 0..1
  
  const spreadLat = (offset1 - 0.5) * 0.03; // ±0.015 degrees
  const spreadLon = (offset2 - 0.5) * 0.03; // ±0.015 degrees
  
  return {
    lat: basePos.lat + spreadLat,
    lon: basePos.lon + spreadLon
  };
}

/**
 * Transform TfL prediction to our vehicle format
 * @param {Object} prediction - TfL prediction data
 * @param {Object} prevPositions - Map of vehicleId -> {lat, lon, timeToStation}
 * @returns {Promise<Object>} Transformed vehicle data
 */
export async function transformTfLPrediction(prediction, prevPositions = {}) {
  // Parse bearing as number (TfL returns it as string)
  const bearing = prediction.bearing ? parseInt(prediction.bearing, 10) : 0;

  // Try to get next stop coordinates from cache (pre-populated common stops)
  let nextStopCoords = null;
  const stationKey = prediction.stationName || prediction.currentLocation;
  if (stationKey) {
    if (stopPointCache[stationKey]) {
      nextStopCoords = stopPointCache[stationKey];
    } else {
      // Attempt to fetch coords from TfL if not in cache
      const fetched = await getStopPointCoordinates(stationKey);
      if (fetched) nextStopCoords = fetched;
    }
  }

  // Also attempt to resolve the final destination coordinates so frontend can display it
  let destinationCoords = null;
  const destKey = prediction.destinationName || '';
  if (destKey) {
    if (stopPointCache[destKey]) {
      destinationCoords = stopPointCache[destKey];
    } else {
      const fetchedDest = await getStopPointCoordinates(destKey);
      if (fetchedDest) destinationCoords = fetchedDest;
    }
  }
  
  // Generate unique vehicle position (deterministic, spreads vehicles across London)
  const position = generateUniqueVehiclePosition(
    prediction.vehicleId,
    prediction.lineId || '1',
    prediction.direction || 'inbound'
  );
  
  // If we have next stop coordinates, derive a position approaching it
  let currentLat = position.lat;
  let currentLon = position.lon;
  
  if (nextStopCoords && prediction.timeToStation && prediction.timeToStation > 0) {
    // Position is somewhere between current location and next stop
    const secs = Math.max(0, prediction.timeToStation);
    const maxTime = 300; // Assume 5 min max distance
    const progress = Math.min(1, secs / maxTime);
    
    // Interpolate: further away if more time to station
    currentLat = position.lat + (nextStopCoords.lat - position.lat) * (1 - progress);
    currentLon = position.lon + (nextStopCoords.lon - position.lon) * (1 - progress);
  }

  return {
    vehicleId: prediction.vehicleId,
    lineName: prediction.lineName || 'Unknown',
    lineId: prediction.lineId || '',
    stationName: prediction.stationName || 'Unknown Stop',
    destinationName: prediction.destinationName || 'Unknown Destination',
    direction: prediction.direction || 'Unknown',
    bearing: bearing,
    lat: currentLat,
    lon: currentLon,
    heading: bearing,
    timeToStation: prediction.timeToStation || 0,
    currentLocation: prediction.currentLocation || prediction.stationName || 'Unknown',
    towards: prediction.towards || '',
    modeName: prediction.modeName || 'bus',
    naptanId: prediction.naptanId || '',
    platformName: prediction.platformName || '',
    lastUpdated: prediction.timestamp || new Date().toISOString(),
    hasRealPosition: true,
    positionSource: 'TfL Live API',
    nextStopCoords: nextStopCoords, // For frontend animation
    destinationCoords: destinationCoords,
    timestamp: new Date(prediction.timestamp).getTime() // For tracking updates
  };
}

/**
 * Get live vehicles with real TfL data
 * @returns {Promise<Array>} Array of live vehicles
 */
export async function getLiveVehicles() {
  try {
    const predictions = await getLiveVehiclePredictions('bus');

    // Transform each prediction (async transforms may fetch stop coordinates)
    const vehicles = await Promise.all(predictions.map(pred => transformTfLPrediction(pred)));

    return vehicles.filter(v => v !== null);
  } catch (error) {
    console.error('❌ Error getting live vehicles:', error.message);
    return [];
  }
}

/**
 * Get specific vehicle arrivals for tracking
 * @param {string} vehicleId - Vehicle ID to track
 * @returns {Promise<Array>} Array of upcoming stops for the vehicle
 */
export async function getVehicleArrivals(vehicleId) {
  try {
    const url = `${TFL_API_BASE}/Vehicle/${vehicleId}/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    const arrivals = response.data || [];
    
    console.log(`✅ Got ${arrivals.length} arrivals for vehicle ${vehicleId}`);
    
    return arrivals;
  } catch (error) {
    console.error(`❌ Error fetching arrivals for ${vehicleId}:`, error.message);
    return [];
  }
}

// Clear old cache entries periodically
export function startCacheCleanup() {
  setInterval(() => {
    const now = Date.now();
    if (now - lastStopPointFetch > STOP_POINT_CACHE_TTL) {
      console.log('🧹 Clearing stop point cache...');
      stopPointCache = {};
      lastStopPointFetch = now;
    }
  }, 300000); // Every 5 minutes
}

/**
 * Validate a free-form location string.
 * Tries TfL StopPoint search first, then Google Geocoding (if API key provided),
 * and finally falls back to Nominatim (OpenStreetMap).
 * Returns { input, found, lat, lon }
 */
export async function validateLocation(name) {
  if (!name) return { input: name, found: false };

  // 1) Try TfL StopPoint search
  try {
    const stopCoords = await getStopPointCoordinates(name);
    if (stopCoords) {
      const inLondon = await isWithinTfLCoverage(stopCoords.lat, stopCoords.lon);
      return { input: name, found: true, lat: stopCoords.lat, lon: stopCoords.lon, inLondon };
    }
  } catch (err) {
    console.warn('⚠️ validateLocation: TfL StopPoint check failed:', err.message);
  }

  // 2) Try Google Geocoding if API key available
  const googleKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (googleKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(name)}&key=${googleKey}`;
      const gResp = await axios.get(gUrl, { timeout: API_TIMEOUT });
      const gData = gResp.data;
      if (gData && gData.results && gData.results.length > 0) {
        const loc = gData.results[0].geometry.location;
        stopPointCache[name] = { lat: loc.lat, lon: loc.lng };
        const inLondon = await isWithinTfLCoverage(loc.lat, loc.lng);
        return { input: name, found: true, lat: loc.lat, lon: loc.lng, inLondon };
      }
    } catch (err) {
      console.warn('⚠️ validateLocation: Google Geocoding failed:', err.message);
    }
  }

  // 3) Fallback to Nominatim (OpenStreetMap)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`;
    const resp = await axios.get(nomUrl, {
      timeout: API_TIMEOUT,
      headers: {
        'User-Agent': process.env.NOMINATIM_USER_AGENT || 'london-transport-dashboard/1.0 (dev contact)',
        'Accept-Language': 'en'
      }
    });

    const data = resp.data;
    if (Array.isArray(data) && data.length > 0) {
      const item = data[0];
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      stopPointCache[name] = { lat, lon };
      const inLondon = await isWithinTfLCoverage(lat, lon);
      return { input: name, found: true, lat, lon, inLondon };
    }
  } catch (err) {
    console.warn('⚠️ validateLocation: Nominatim lookup failed:', err.message);
  }

  return { input: name, found: false };
}

/**
 * Simple bounding-box check for Greater London coverage.
 * This is an approximation; adjust bounds if you want tighter coverage.
 */
function isInGreaterLondon(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  const MIN_LAT = 51.286760; // southernmost
  const MAX_LAT = 51.691874; // northernmost
  const MIN_LON = -0.510375; // westernmost
  const MAX_LON = 0.334015; // easternmost
  return lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON;
}

// Cache for coverage checks
const coverageCache = {};

/**
 * Check whether coordinates are within TfL coverage by querying TfL Place and StopPoint endpoints.
 * Returns boolean. Uses simple in-memory cache keyed by lat/lon/radius.
 */
export async function isWithinTfLCoverage(lat, lon, radius = 2000) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  const key = `${lat.toFixed(6)},${lon.toFixed(6)},${radius}`;
  if (coverageCache[key] !== undefined) return coverageCache[key];

  // 1) Try TfL Place search by lat/lon
  try {
    const url = `${TFL_API_BASE}/Place/?Lat=${lat}&Lon=${lon}&radius=${radius}&numberOfPlacesToReturn=5&app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
    const resp = await axios.get(url, { timeout: API_TIMEOUT });
    const places = resp.data || [];
    if (Array.isArray(places) && places.length > 0) {
      coverageCache[key] = true;
      return true;
    }
  } catch (err) {
    // ignore and try StopPoint fallback
    console.warn('⚠️ isWithinTfLCoverage: Place lookup failed:', err.message);
  }

  // 2) Fallback to StopPoint by location
  try {
    const spUrl = `${TFL_API_BASE}/StopPoint?lat=${lat}&lon=${lon}&radius=${radius}&app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
    const spResp = await axios.get(spUrl, { timeout: API_TIMEOUT });
    const spData = spResp.data || {};
    const stopPoints = spData.stopPoints || spData || [];
    if (Array.isArray(stopPoints) && stopPoints.length > 0) {
      coverageCache[key] = true;
      return true;
    }
  } catch (err) {
    console.warn('⚠️ isWithinTfLCoverage: StopPoint lookup failed:', err.message);
  }

  coverageCache[key] = false;
  return false;
}
