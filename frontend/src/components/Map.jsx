import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

const Map = ({ bikePoints, accidentStats, onMapClick, journeyRoute }) => {
  // Parse journey route if provided
  const routePolylines = [];
  const journeyMarkers = [];
  
  if (journeyRoute) {
    console.log('🗺️ Rendering journey route:', journeyRoute);
    
    // Extract coordinates from path data
    journeyRoute.legs?.forEach((leg, index) => {
      // Try to get coordinates from path lineString
      if (leg.path?.lineString) {
        try {
          // CORRECTED: The lineString format needs proper parsing
          // It might be in format: "[[[lon,lat],[lon,lat],...]]"
          const geoJson = JSON.parse(leg.path.lineString);
          
          // Function to parse and swap coordinates
          const parseAndSwapCoordinates = (arr) => {
            if (Array.isArray(arr)) {
              if (arr.length === 2 && typeof arr[0] === 'number') {
                // Found [lon, lat] - SWAP to [lat, lon]
                return [[arr[1], arr[0]]];
              } else {
                // Process nested arrays
                return arr.flatMap(item => parseAndSwapCoordinates(item));
              }
            }
            return [];
          };
          
          const coordinates = parseAndSwapCoordinates(geoJson);
          
          if (coordinates.length > 0) {
            const modeId = leg.mode?.id;
            routePolylines.push({
              positions: coordinates,
              color: getLegColor(modeId),
              mode: modeId,
              dashArray: modeId === 'walking' ? '10, 5' : undefined,
              weight: modeId === 'walking' ? 3 : undefined,
              key: `leg-${index}`
            });
            
            // Add markers for start and end
            journeyMarkers.push({
              position: coordinates[0],
              type: 'departure',
              legIndex: index,
              mode: leg.mode,
              time: leg.departureTime,
              summary: leg.instruction?.summary
            });
            
            journeyMarkers.push({
              position: coordinates[coordinates.length - 1],
              type: 'arrival', 
              legIndex: index,
              mode: leg.mode,
              time: leg.arrivalTime,
              summary: leg.instruction?.summary
            });
          }
        } catch (error) {
          console.error('Error parsing route coordinates:', error);
        }
      }
      
      // Fallback: use departure/arrival points if available
      else if (leg.departurePoint?.lat && leg.arrivalPoint?.lat) {
        journeyMarkers.push({
          position: [leg.departurePoint.lat, leg.departurePoint.lon],
          type: 'departure',
          legIndex: index,
          mode: leg.mode,
          time: leg.departureTime,
          summary: leg.instruction?.summary
        });
        
        journeyMarkers.push({
          position: [leg.arrivalPoint.lat, leg.arrivalPoint.lon],
          type: 'arrival',
          legIndex: index,
          mode: leg.mode,
          time: leg.arrivalTime,
          summary: leg.instruction?.summary
        });
        
        // Add straight line between departure and arrival
        const modeId = leg.mode?.id;
        routePolylines.push({
          positions: [
            [leg.departurePoint.lat, leg.departurePoint.lon],
            [leg.arrivalPoint.lat, leg.arrivalPoint.lon]
          ],
          color: getLegColor(modeId),
          mode: modeId,
          dashArray: modeId === 'walking' ? '10, 5' : undefined,
          weight: modeId === 'walking' ? 3 : undefined,
          key: `leg-${index}-fallback`
        });
      }
    });
  }

  return (
    <MapContainer
      center={[51.505, -0.09]}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      <MapClickHandler onMapClick={onMapClick} />
      
      {/* Journey Route Lines */}
      {routePolylines.map(polyline => (
        <Polyline
          key={polyline.key}
          positions={polyline.positions}
          color={polyline.color}
          weight={3}
          dashArray={polyline.dashArray}
          opacity={0.7}
        />
      ))}
      
      {/* Journey Markers */}
      {journeyMarkers.map((marker, index) => (
        <Marker key={`journey-${index}`} position={marker.position}>
          <Popup>
            <strong>
              {marker.type === 'departure' ? '🚀 Departure' : '🏁 Arrival'} 
              {marker.mode?.name ? ` (${marker.mode.name})` : ''}
            </strong>
            <br />
            {marker.summary && (
              <>
                {marker.summary}
                <br />
              </>
            )}
            {marker.time && (
              <>
                Time: {new Date(marker.time).toLocaleTimeString()}
                <br />
              </>
            )}
            Leg {marker.legIndex + 1}
          </Popup>
        </Marker>
      ))}
      
      {/* Bike Points */}
      {bikePoints && bikePoints.map(point => (
        <Marker key={point.id} position={[point.lat, point.lon]}>
          <Popup>
            <strong>🚲 {point.name}</strong><br />
            Bikes: {point.bikes}<br />
            Empty Docks: {point.emptyDocks}
          </Popup>
        </Marker>
      ))}

      {/* Accident Stats */}
      {accidentStats && accidentStats.map(accident => (
        <Marker key={accident.id} position={[accident.lat, accident.lon]}>
          <Popup>
            <strong>🚨 Accident</strong><br />
            {accident.location}<br />
            Severity: {accident.severity}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

// Helper function for route colors based on transport mode
const getLegColor = (modeId) => {
  const colors = {
    'tube': '#FF3030',
    'bus': '#FFA500',
    'overground': '#FF69B4',
    'dlr': '#00CED1',
    'tram': '#32CD32',
    'walking': '#4a6fa5',
    'cycle': '#228B22',
    'river-bus': '#1E90FF',
    'national-rail': '#8A2BE2'
  };
  return colors[modeId] || '#000000';
};

export default Map;