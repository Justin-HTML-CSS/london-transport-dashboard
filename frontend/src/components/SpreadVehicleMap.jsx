import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SpreadVehicleMap = ({ vehicles, selectedVehicle, onClose }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && vehicles.length > 0) {
      // Calculate bounds from all vehicle positions
      const positions = vehicles.map(v => [v.lat, v.lon]);
      const bounds = L.latLngBounds(positions);
      
      // Fit bounds with padding
      mapRef.current.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 12
      });
      
      // Debug log
      console.log('🗺️ SpreadVehicleMap - Vehicle positions:');
      vehicles.forEach((v, i) => {
        console.log(`${i}: ${v.lineName} - ${v.lat.toFixed(6)}, ${v.lon.toFixed(6)}`);
      });
      console.log('📐 Map bounds:', bounds);
    }
  }, [vehicles]);

  // Simple bus icon
  const createBusIcon = (lineName, isSelected) => {
    const colors = {
      '1': '#FF3030', '12': '#FFA500', '18': '#32CD32', '24': '#1E90FF',
      '38': '#8A2BE2', '55': '#FF69B4', '73': '#00CED1', '94': '#FFD700'
    };
    const color = colors[lineName] || '#4a6fa5';
    
    return L.divIcon({
      html: `
        <div style="
          background: ${isSelected ? '#FF0000' : color};
          width: 28px;
          height: 16px;
          border-radius: 3px;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 11px;
        ">${lineName}</div>
      `,
      iconSize: [28, 16],
      iconAnchor: [14, 8]
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🚍 Vehicle Spread Test</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="vehicle-info">
            <p><strong>Testing {vehicles.length} vehicles</strong></p>
            <p>If vehicles are spread out here but not in AnimatedVehicleMap, 
              the issue is in AnimatedVehicleMap rendering.</p>
            <button 
              onClick={() => {
                console.log('📍 Vehicle positions:');
                vehicles.forEach((v, i) => {
                  console.log(`${i}: ${v.lineName} - ${v.lat}, ${v.lon}`);
                });
              }}
              style={{ padding: '8px 12px', marginTop: '10px' }}
            >
              Log Positions
            </button>
          </div>
          
          <div className="modal-map-container">
            <MapContainer
              center={[51.5074, -0.1278]}
              zoom={11}
              style={{ height: '500px', width: '100%' }}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
              />
              
              {vehicles.map((vehicle, index) => {
                const isSelected = selectedVehicle && selectedVehicle.vehicleId === vehicle.vehicleId;
                return (
                  <Marker
                    key={`test-${index}`}
                    position={[vehicle.lat, vehicle.lon]}
                    icon={createBusIcon(vehicle.lineName, isSelected)}
                  >
                    <Popup>
                      <strong>{vehicle.lineName}</strong><br />
                      Lat: {vehicle.lat.toFixed(6)}<br />
                      Lon: {vehicle.lon.toFixed(6)}<br />
                      Area: {vehicle.routeArea}
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SpreadVehicleMap;