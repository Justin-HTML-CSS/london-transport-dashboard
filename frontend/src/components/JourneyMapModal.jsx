import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet icons
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Helper functions - defined at top
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
  return colors[modeId] || '#4a6fa5';
};

const getModeIcon = (modeId) => {
  const icons = {
    'tube': '🚇',
    'bus': '🚌',
    'overground': '🚆',
    'dlr': '🚈',
    'tram': '🚊',
    'walking': '🚶',
    'cycle': '🚴',
    'river-bus': '⛴️',
    'national-rail': '🚄'
  };
  return icons[modeId] || '📍';
};

function getModeLabel(modeId) {
  const labels = {
    'tube': '🚇 Tube',
    'bus': '🚌 Bus',
    'overground': '🚆 Overground',
    'dlr': '🚈 DLR',
    'tram': '🚊 Tram',
    'walking': '🚶 Walking',
    'cycle': '🚴 Cycle',
    'river-bus': '⛴️ River Bus',
    'national-rail': '🚄 National Rail'
  };
  return labels[modeId] || modeId.charAt(0).toUpperCase() + modeId.slice(1);
}

// Legend Control Component
function MapLegend({ routePolylines }) {
  const map = useMap();
  
  useEffect(() => {
    if (!map || !routePolylines || routePolylines.length === 0) return;
    
    // Get unique transport modes from the route polylines
    const modes = new Set();
    routePolylines.forEach(polyline => {
      if (polyline.mode?.id) {
        modes.add(polyline.mode.id);
      }
    });
    
    if (modes.size === 0) return;
    
    // Create custom legend control
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function(map) {
      const div = L.DomUtil.create('div', 'journey-map-legend');
      div.style.background = 'white';
      div.style.padding = '12px 15px';
      div.style.borderRadius = '8px';
      div.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
      div.style.fontSize = '13px';
      div.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
      div.style.maxWidth = '200px';
      div.style.zIndex = '500';
      
      let html = '<strong style="display: block; margin-bottom: 8px; font-size: 14px;">Transport Modes</strong>';
      
      modes.forEach(modeId => {
        const color = getLegColor(modeId);
        const name = getModeLabel(modeId);
        html += `
          <div style="display: flex; align-items: center; margin-bottom: 6px; gap: 8px;">
            <div style="width: 16px; height: 16px; background-color: ${color}; border-radius: 2px; flex-shrink: 0;"></div>
            <span>${name}</span>
          </div>
        `;
      });
      
      div.innerHTML = html;
      return div;
    };
    
    legend.addTo(map);
    
    return () => {
      legend.remove();
    };
  }, [map, routePolylines]);
  
  return null;
}

function MapBoundsFitter({ positions }) {
  const map = useMap();
  
  useEffect(() => {
    if (positions && positions.length > 1) {
      try {
        const bounds = L.latLngBounds(positions);
        // Fit bounds with aggressive zoom to focus on markers in London
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, minZoom: 13 });
        console.log('🗺️ Map bounds fitted to', bounds);
      } catch (error) {
        console.warn('Error fitting bounds:', error);
      }
    } else if (positions && positions.length === 1) {
      // Single position - zoom to that location
      map.setView(positions[0], 15);
    }
  }, [map, positions]);

  return null;
}

const JourneyMapModal = ({ journey, onClose }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (journey) {
      console.log('🗺️ Journey received:', journey);
      setIsLoading(false);
    }
  }, [journey]);

  // SIMPLIFIED: Parse coordinates from journey legs
  const { routePolylines, journeyMarkers, allPositions, firstDeparture, lastArrival } = useMemo(() => {
    const routePolylines = [];
    const journeyMarkers = [];
    const allPositions = [];
    let firstDeparture = null;
    let lastArrival = null;

    if (!journey?.legs) {
      return { routePolylines, journeyMarkers, allPositions, firstDeparture, lastArrival };
    }

    journey.legs.forEach((leg, index) => {
      // Parse lineString if available
      if (leg.path?.lineString) {
        try {
          // Parse the lineString - handle both formats
          const coordinates = parseLineStringSimple(leg.path.lineString);
          
          if (coordinates.length > 0) {
            const modeId = leg.mode?.id;
            routePolylines.push({
              positions: coordinates,
              color: getLegColor(modeId),
              key: `leg-${index}`,
              mode: leg.mode,
              isDetailed: true,
              weight: modeId === 'walking' ? 3 : 8,
              dashArray: modeId === 'walking' ? '10, 5' : undefined,
              opacity: 0.9,
              outlineColor: '#222',
              outlineWeight: 11,
              outlineOpacity: 0.22
            });
            
            allPositions.push(...coordinates);
          }
        } catch (error) {
          console.error('Error parsing lineString:', error);
        }
      }
      
      // Always add departure and arrival markers
      if (leg.departurePoint?.lat && leg.departurePoint?.lon) {
        const departurePos = [leg.departurePoint.lat, leg.departurePoint.lon];
        
        journeyMarkers.push({
          position: departurePos,
          type: 'departure',
          legIndex: index,
          mode: leg.mode,
          time: leg.departureTime,
          summary: leg.instruction?.summary
        });
        
        allPositions.push(departurePos);
        
        // Track first departure point
        if (index === 0) {
          firstDeparture = departurePos;
        }
      }
      
      if (leg.arrivalPoint?.lat && leg.arrivalPoint?.lon) {
        const arrivalPos = [leg.arrivalPoint.lat, leg.arrivalPoint.lon];
        
        journeyMarkers.push({
          position: arrivalPos,
          type: 'arrival',
          legIndex: index,
          mode: leg.mode,
          time: leg.arrivalTime,
          summary: leg.instruction?.summary
        });
        
        allPositions.push(arrivalPos);
        
        // Track last arrival point
        if (index === journey.legs.length - 1) {
          lastArrival = arrivalPos;
        }
      }
      
    });

    // Do NOT add straight connector lines between markers - only show detailed lineStrings from TfL API

    console.log(`🎯 Built route: ${routePolylines.length} lines, ${journeyMarkers.length} markers`);
    return { routePolylines, journeyMarkers, allPositions, firstDeparture, lastArrival };
  }, [journey]);

  // SIMPLIFIED PARSING FUNCTION - FIXED VERSION (hoisted)
  function parseLineStringSimple(lineString) {
    try {
      if (!lineString) return [];
      
      console.log('🔍 Parsing lineString:', lineString.substring(0, 100));
      
      // Try JSON parsing first
      try {
        const geoJson = JSON.parse(lineString);

        // Normalizer: takes two numeric values and returns [lat, lon]
        const normalizePair = (a, b) => {
          // Heuristics for London approx ranges
          const isLatA = a > 49 && a < 56;
          const isLonA = a > -10 && a < 10;
          const isLatB = b > 49 && b < 56;
          const isLonB = b > -10 && b < 10;

          if (isLatA && isLonB) return [a, b]; // [lat, lon]
          if (isLatB && isLonA) return [b, a]; // [lat, lon] after swap

          // If one value has absolute > 90 it's almost certainly longitude/latitude order
          if (Math.abs(a) > 90 && Math.abs(b) <= 90) return [b, a];
          if (Math.abs(b) > 90 && Math.abs(a) <= 90) return [a, b];

          // Fallback: if first value looks like lon (|a|<180) and second looks like lat (~50), swap
          if (Math.abs(a) <= 180 && b > 45 && b < 60) return [b, a];

          // As a last resort, assume values are [lon, lat] and swap
          return [b, a];
        };

        // Recursive extractor that normalizes pairs to [lat, lon]
        const extractCoordinates = (arr, result = []) => {
          if (!Array.isArray(arr)) return result;

          if (arr.length === 2 && typeof arr[0] === 'number' && typeof arr[1] === 'number') {
            const [lat, lon] = normalizePair(arr[0], arr[1]);
            if (!isNaN(lat) && !isNaN(lon)) result.push([lat, lon]);
          } else {
            arr.forEach(item => extractCoordinates(item, result));
          }

          return result;
        };

        const coordinates = extractCoordinates(geoJson);
        console.log(`✅ JSON parsed and normalized: ${coordinates.length} coordinates`);

        // Prefer coordinates that fall within Greater London bounds
        const londonCoords = coordinates.filter(([lat, lon]) =>
          lat > 50.5 && lat < 52.0 && lon > -1.5 && lon < 1.5
        );

        if (londonCoords.length > 0) {
          console.log(`📍 London coordinates (filtered): ${londonCoords.length}`);
          return londonCoords;
        }

        return coordinates;

      } catch (jsonError) {
        console.log('🔄 JSON parse failed, trying manual parsing');

        // Manual parsing for malformed JSON
        const manualCoords = parseManually(lineString);
        console.log(`🔧 Manual parsed: ${manualCoords.length} coordinates`);
        return manualCoords;
      }
      
    } catch (error) {
      console.error('❌ Parse error:', error);
      return [];
    }
  };

  // Manual parsing fallback (hoisted)
  function parseManually(lineString) {
    const coordinates = [];

    // Remove brackets and capture numeric pairs
    const cleaned = lineString.replace(/[\[\]]/g, ' ');
    const pairs = cleaned.match(/-?\d+\.?\d*\s*,\s*-?\d+\.?\d*/g);

    const normalizePair = (a, b) => {
      // Use the same heuristic as JSON parser
      const isLatA = a > 49 && a < 56;
      const isLonA = a > -10 && a < 10;
      const isLatB = b > 49 && b < 56;
      const isLonB = b > -10 && b < 10;

      if (isLatA && isLonB) return [a, b];
      if (isLatB && isLonA) return [b, a];
      if (Math.abs(a) > 90 && Math.abs(b) <= 90) return [b, a];
      if (Math.abs(b) > 90 && Math.abs(a) <= 90) return [a, b];
      if (Math.abs(a) <= 180 && b > 45 && b < 60) return [b, a];
      return [b, a];
    };

    if (pairs) {
      pairs.forEach(pair => {
        const [aStr, bStr] = pair.split(',');
        const a = parseFloat(aStr.trim());
        const b = parseFloat(bStr.trim());

        if (!isNaN(a) && !isNaN(b)) {
          const [lat, lon] = normalizePair(a, b);
          coordinates.push([lat, lon]);
        }
      });
    }

    return coordinates;
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatTime = (dateTimeStr) => {
    if (!dateTimeStr) return 'N/A';
    try {
      return new Date(dateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return 'Invalid time';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Journey Route</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {/* Journey Summary */}
          <div className="journey-summary-card">
            <div className="summary-row">
              <div className="summary-item">
                <strong>Total Duration:</strong>
                <span className="duration-badge">{formatDuration(journey?.duration)}</span>
              </div>
              <div className="summary-item">
                <strong>Start:</strong>
                <span>{formatTime(journey?.startDateTime)}</span>
              </div>
              <div className="summary-item">
                <strong>Arrival:</strong>
                <span>{formatTime(journey?.arrivalDateTime)}</span>
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="modal-map-container" style={{ height: '370px', marginTop: '15px' }}>
            <MapContainer
              center={[51.505, -0.09]}
              zoom={11}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {allPositions.length > 0 && (
                <MapBoundsFitter positions={allPositions} />
              )}
              
              {routePolylines.length > 0 && (
                <MapLegend routePolylines={routePolylines} />
              )}
              
              {/* Route Lines (outline underneath + colored line above) */}
              {routePolylines.map(polyline => (
                <React.Fragment key={polyline.key}>
                  {polyline.outlineColor && (
                    <Polyline
                      key={`${polyline.key}-outline`}
                      positions={polyline.positions}
                      color={polyline.outlineColor}
                      weight={3}
                      opacity={polyline.outlineOpacity !== undefined ? polyline.outlineOpacity : 0.22}
                      lineCap={polyline.lineCap || 'round'}
                      lineJoin={polyline.lineJoin || 'round'}
                    />
                  )}

                  <Polyline
                    key={polyline.key}
                    positions={polyline.positions}
                    color={polyline.color}
                    weight={3}
                    opacity={polyline.opacity !== undefined ? polyline.opacity : (polyline.isDetailed ? 0.9 : 0.6)}
                    dashArray={polyline.dashArray || (polyline.isFallback ? '5, 10' : undefined)}
                    lineCap={polyline.lineCap || 'round'}
                    lineJoin={polyline.lineJoin || 'round'}
                  />
                </React.Fragment>
              ))}
              
              {/* Journey Markers */}
              {journeyMarkers.map((marker, index) => (
                <Marker key={`marker-${index}`} position={marker.position}>
                  <Popup>
                    <div className="marker-popup">
                      <strong>
                        {marker.type === 'departure' ? '🚀 Departure' : '🏁 Arrival'}
                        {marker.mode?.name ? ` (${marker.mode.name})` : ''}
                      </strong>
                      <br />
                      {marker.summary}
                      <br />
                      Time: {formatTime(marker.time)}
                      <br />
                      Leg {marker.legIndex + 1}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          {/* Journey Legs Details */}
          <div className="journey-legs-details">
            <h4>Journey Steps:</h4>
            <div className="legs-timeline">
              {journey?.legs?.map((leg, index) => (
                <div key={index} className="leg-timeline-item">
                  <div className="timeline-marker">
                    <span className="mode-icon">
                      {getModeIcon(leg.mode?.id)}
                    </span>
                  </div>
                  <div className="leg-info">
                    <div className="leg-header">
                      <span className="leg-mode">{leg.mode?.name || 'Travel'}</span>
                      <span className="leg-duration">{formatDuration(leg.duration)}</span>
                    </div>
                    <div className="leg-description">
                      {leg.instruction?.summary || 'No details available'}
                    </div>
                    <div className="leg-times">
                      {formatTime(leg.departureTime)} → {formatTime(leg.arrivalTime)}
                      {leg.distance && (
                        <span className="leg-distance">
                          • {(leg.distance / 1000).toFixed(1)}km
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JourneyMapModal;