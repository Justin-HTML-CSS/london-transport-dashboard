import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const TestVehicleMap = ({ vehicles, onClose }) => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current && vehicles.length > 0) {
      // Create bounds from all vehicle positions
      const bounds = L.latLngBounds(
        vehicles.map(v => [v.lat, v.lon])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      
      // Debug: Log positions
      console.log('🗺️ Test Map - All vehicle positions:');
      vehicles.forEach((v, i) => {
        console.log(`Vehicle ${i}: ${v.lat.toFixed(6)}, ${v.lon.toFixed(6)} - ${v.lineName}`);
      });
    }
  }, [vehicles]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Test Vehicle Map</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-map-container">
          <MapContainer
            center={[51.5074, -0.1278]}
            zoom={11}
            style={{ height: '370px', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            
            {vehicles.map((vehicle, index) => (
              <Marker
                key={index}
                position={[vehicle.lat, vehicle.lon]}
                icon={L.divIcon({
                  html: `<div style="background: #FF3030; color: white; padding: 4px; border-radius: 4px; border: 2px solid white;">${vehicle.lineName}</div>`,
                  iconSize: [40, 25],
                  iconAnchor: [20, 12]
                })}
              >
                <Popup>
                  <strong>{vehicle.lineName}</strong><br />
                  {vehicle.lat.toFixed(6)}, {vehicle.lon.toFixed(6)}<br />
                  Area: {vehicle.routeArea}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
        
        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default TestVehicleMap;