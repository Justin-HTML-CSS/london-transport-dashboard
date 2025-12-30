import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';

const MapComponent = ({ bikePoints = [], accidentStats = [], onMapClick = () => {} }) => {
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
      
      {bikePoints.map(point => (
        <Marker key={point.id} position={[point.lat, point.lon]}>
          <Popup>
            <strong>🚲 {point.name}</strong><br />
            Bikes: {point.bikes}<br />
            Empty Docks: {point.emptyDocks}
          </Popup>
        </Marker>
      ))}

      {accidentStats.map(accident => (
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

export default MapComponent;