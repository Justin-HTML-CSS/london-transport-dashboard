# Vehicle Map Location Fix

## Problem
When clicking "Show on Map" for a vehicle, the map was displaying the vehicle at an incorrect location that didn't match the "Destination" description shown in the vehicle details.

## Root Cause
The modal was only showing:
- The vehicle's current position (correct)
- The next stop coordinates (vehicle.nextStopCoords, green marker)
- But NOT the final destination coordinates

The user expected to see the vehicle's position relative to its **final destination**, not just the next stop. The destination shown in the vehicle card ("Destination: Stratford") wasn't being visualized on the map.

## Solution
Updated [VehicleMapModal.jsx](frontend/src/components/VehicleMapModal.jsx) to:

1. **Fetch destination coordinates** - Added a new `useEffect` hook that fetches the coordinates for the `destinationName` using the same `/api/journey/coords` endpoint used by the Journey Planner.

2. **Display destination on map** - Added a new red marker showing the final destination location, making it clear where the bus is headed.

3. **Enhanced info panel** - Added a new "Final Destination" section in the vehicle info panel that displays:
   - The destination name
   - Destination coordinates (latitude & longitude)

## Visual Changes on Map
- 🔵 **Blue Circle** - Vehicle accuracy/coverage area
- 🚌 **Blue Bus Icon** - Current vehicle position with live animation
- 🟢 **Green Marker** - Next stop (intermediate stop)
- 🔴 **Red Marker** - Final Destination

This makes it immediately clear:
1. Where the vehicle currently is
2. Where it's going next
3. Where it's ultimately headed

## Testing
To verify the fix works:
1. Start the backend and frontend
2. Navigate to "Live Vehicles" tab
3. Click "Show on Map" on any vehicle
4. Verify that:
   - Red marker shows the final destination location
   - Green marker shows the next stop
   - Bus icon is positioned between them (moving towards next stop)
   - Info panel shows "Final Destination" with coordinates
   - The displayed Destination value matches the red marker location

## Files Modified
- `frontend/src/components/VehicleMapModal.jsx`
  - Added `destinationCoords` state
  - Added useEffect to fetch destination coordinates
  - Added red destination marker to map
  - Added "Final Destination" info section
