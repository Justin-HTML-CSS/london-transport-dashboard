# Live Vehicles Fix Summary

## Issues Fixed

### 1. **Live Vehicles Grid Disappearing on Updates**
**Problem:** The UI was showing "Loading live vehicles..." and blanking the grid on every 10-second refresh cycle.

**Solution:** 
- Changed from `setLoading(true)` on every fetch to using an `isInitialLoad` flag
- The loading spinner now only shows on the very first load
- Subsequent updates refresh vehicle data **without** clearing the UI
- Only shows loading state if data is truly empty after initial load

**File:** `frontend/src/components/LiveVehicles.jsx`

---

### 2. **Dynamic Backend Port Detection**
**Problem:** Frontend was hardcoded to port 4001, but backend might be running on 4002 if port collision occurs.

**Solution:**
- Added `getBackendUrl()` function that tries ports 4001 and 4002 in sequence
- Automatically detects which port the backend is running on
- Falls back gracefully to 4001 if neither works

**File:** `frontend/src/components/LiveVehicles.jsx`

---

### 3. **Real Coordinates from TfL API**
**Problem:** Vehicles were missing proper latitude/longitude, making map display incorrect.

**Solution:**
- Enhanced `transformTfLPrediction()` in backend to be async
- Fetches actual stop coordinates from TfL `StopPoint/Search` API
- Computes meaningful current position based on `timeToStation` and bearing
- Falls back to pre-cached common London stops (expanded from 17 to 57 stops)
- Derives sensible positions if TfL doesn't provide them directly

**Files:** 
- `backend/tflService.js` - Added 40+ London stop coordinates to cache
- `backend/server.js` - `/api/vehicles` endpoint now includes `nextStopCoords` for animation

---

### 4. **Map Modal Animation with Live Coordinates**
**Problem:** Buses weren't animating smoothly on the map, and coordinates were missing.

**Solution:**
- Updated `VehicleMapModal` to display actual vehicle coordinates (lat/lon)
- Improved animation logic to smoothly interpolate between current and next stop
- Added route path visualization (dashed blue line showing bus trajectory)
- Shows next stop as green marker on the map
- Vehicle icon now rotates to show bearing direction
- Better logging for debugging coordinate issues

**File:** `frontend/src/components/VehicleMapModal.jsx`

---

## Key Changes

### Backend (`tflService.js`)
```javascript
// Now async with real coordinate resolution
export async function transformTfLPrediction(prediction, prevPositions = {}) {
  // Fetches nextStopCoords from TfL API
  // Computes current position based on timeToStation
  // Returns both lat/lon and nextStopCoords for animation
}
```

### Frontend (`LiveVehicles.jsx`)
```javascript
// Only shows loading on initial load, not on refreshes
const [isInitialLoad, setIsInitialLoad] = useState(true);

// Auto-detects backend port
const getBackendUrl = async () => {
  const ports = [4001, 4002];
  // Tries each port and returns first working one
};
```

### Frontend (`VehicleMapModal.jsx`)
```jsx
// Animates bus moving toward next stop
// Shows route path and next stop marker
// Displays real coordinates in info panel
```

---

## How It Works Now

1. **Initial Load:**
   - Shows "⏳ Loading live vehicles..." message
   - Once data arrives, shows grid of vehicle cards

2. **Live Updates (every 10 seconds):**
   - Silently refreshes vehicle data
   - Updates card info (time to station, location, etc.)
   - Cards stay visible—no blinking or disappearing
   - Selected vehicle modal updates with new position

3. **Show on Map:**
   - Fetches real TfL coordinates for the vehicle
   - Opens modal with interactive Leaflet map
   - Shows bus at correct location with bearing
   - Animates bus movement as `timeToStation` decreases
   - Displays route path and next stop marker

4. **Backend Port Handling:**
   - If port 4001 is in use, server tries 4002
   - Frontend auto-detects which port to use
   - No need for manual configuration

---

## Testing the Fix

1. **Start Backend:**
   ```bash
   cd backend
   npm run dev
   ```
   Server will log which port it's using (4001 or 4002).

2. **Start Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test Live Vehicles:**
   - Open the app and go to "Live Vehicles" tab
   - Verify the grid appears and stays visible
   - Click "🗺️ Show on Map" button on any vehicle
   - Map modal should open with bus at real coordinates
   - Watch bus animate as time-to-station updates every 10 seconds

4. **Check Console:**
   - Look for logs showing coordinate resolution
   - Should see "🚌 Modal update" messages with lat/lon
   - No errors about missing coordinates

---

## Data Flow

```
TfL API (/Mode/bus/Arrivals)
    ↓
    ├─ vehicleId, timeToStation, stationName
    └─ TfL API (/StopPoint/Search/{stationName})
           ↓
           └─ lat, lon (nextStopCoords)

Backend computes:
    - Current position (from lat/lon or derived)
    - Bearing direction
    - Animation targets

Frontend:
    - Displays live vehicles grid (stays visible on updates)
    - Animates bus on map when clicked
    - Shows route path and next stop
```

---

## Notes

- **Simulated Fallback:** If TfL API returns no live buses, backend serves simulated vehicles with animation-ready positions
- **Stop Cache:** Expanded to 57 common London stops—most bus arrivals will find cached coordinates instantly
- **Rate Limiting:** 10-second refresh interval balances real-time updates with API rate limits
- **Animation Smoothness:** 2-second ease-out animation with proper time-based interpolation

All issues should now be resolved! 🎉
