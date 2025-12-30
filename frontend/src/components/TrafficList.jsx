import React from 'react';

const TrafficList = ({ data, selectedTab, onVehicleLocationClick }) => {
  if (!data) return <div>Loading data...</div>;

  const getStatusColor = (severity) => {
    if (severity >= 10) return 'good';
    if (severity >= 7) return 'warning';
    return 'danger';
  };

  const getPositionStatus = (vehicle) => {
    if (!vehicle.lat || !vehicle.lon) return '❌ No position';
    if (vehicle.hasRealPosition === false || vehicle.positionSource === 'simulated') {
      return '📍 Assigned position';
    }
    if (vehicle.hasRealPosition === true) {
      return '📍 Real GPS position';
    }
    return '📍 Unknown position';
  };

  const getPositionSourceText = (vehicle) => {
    const source = vehicle.positionSource;
    switch(source) {
      case 'text_location': return 'Real GPS (from TfL text)';
      case 'route_based': return 'Route-based estimate';
      case 'simulated': return 'Simulated position';
      case 'simulated_fallback': return 'Fallback simulation';
      default: return vehicle.hasRealPosition === true ? 'Real GPS' : 'Estimated';
    }
  };

  const getPositionBadgeColor = (vehicle) => {
    if (vehicle.hasRealPosition === true) {
      return {
        background: '#d4edda',
        color: '#155724',
        border: '1px solid #c3e6cb'
      };
    } else {
      return {
        background: '#fff3cd',
        color: '#856404',
        border: '1px solid #ffeaa7'
      };
    }
  };

  const handleViewOnMapClick = (vehicle) => {
    console.log('📍 View on Map clicked for vehicle:', {
      vehicleId: vehicle.vehicleId,
      lineName: vehicle.lineName,
      hasRealPosition: vehicle.hasRealPosition,
      positionSource: vehicle.positionSource,
      lat: vehicle.lat,
      lon: vehicle.lon
    });
    
    if (onVehicleLocationClick) {
      onVehicleLocationClick(vehicle);
    } else {
      console.error('onVehicleLocationClick callback not provided');
    }
  };

  const renderContent = () => {
    switch (selectedTab) {
      case 'lines':
        return data.lineStatus?.map(line => (
          <div key={line.id} className={`card ${getStatusColor(line.lineStatuses[0]?.statusSeverity)}`}>
            <h4>{line.name} ({line.modeName})</h4>
            <p>{line.lineStatuses[0]?.statusSeverityDescription}</p>
            {line.lineStatuses[0]?.reason && (
              <small>{line.lineStatuses[0].reason}</small>
            )}
          </div>
        ));
      
      case 'bikes':
        return data.bikePoints?.slice(0, 8).map(point => (
          <div key={point.id} className="card">
            <h4>🚲 {point.name}</h4>
            <p>Bikes Available: {point.bikes}</p>
            <p>Empty Docks: {point.emptyDocks}/{point.totalDocks}</p>
          </div>
        ));
      
      case 'accidents':
        return data.accidentStats?.slice(0, 6).map(accident => (
          <div key={accident.id} className="card danger">
            <h4>🚨 Accident in {accident.borough}</h4>
            <p>Severity: {accident.severity}</p>
            <p>Location: {accident.location}</p>
          </div>
        ));
      
      case 'roads':
        return data.roadStatus?.slice(0, 8).map(road => (
          <div key={road.id} className={`card ${getStatusColor(road.statusSeverity)}`}>
            <h4>🛣️ {road.displayName}</h4>
            <p>Status: {road.statusSeverityDescription}</p>
            {road.disruptionDetails && (
              <small>{road.disruptionDetails}</small>
            )}
            {road.location && (
              <p><em>Location: {road.location}</em></p>
            )}
          </div>
        ));
      
      case 'air':
        return data.airQuality?.currentForecast?.map((forecast, index) => (
          <div key={index} className="card">
            <h4>🌤️ Air Quality</h4>
            <p>Band: {forecast.forecastBand}</p>
            <p>Summary: {forecast.forecastSummary}</p>
          </div>
        ));
      
      case 'network':
        return data.networkStatus?.slice(0, 6).map(network => (
          <div key={network.id} className="card">
            <h4>🚆 {network.name}</h4>
            <p>Status: {network.lineStatuses[0]?.statusSeverityDescription}</p>
          </div>
        ));

      case 'vehicles':
        // Check if vehicleTracking exists and has data
        if (!data.vehicleTracking || data.vehicleTracking.length === 0) {
          return (
            <div className="card warning">
              <h4>🚌 No Live Vehicles Available</h4>
              <p>Currently no vehicle tracking data available.</p>
              <p><small>This could be due to:</small></p>
              <ul style={{ fontSize: '0.9em', marginLeft: '20px', textAlign: 'left' }}>
                <li>API rate limiting</li>
                <li>No active vehicles on tracked routes</li>
                <li>Temporary service disruption</li>
              </ul>
              <button 
                style={{ 
                  marginTop: '10px',
                  padding: '8px 16px',
                  background: '#4a6fa5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => window.location.reload()}
              >
                🔄 Refresh Data
              </button>
            </div>
          );
        }
        
        return data.vehicleTracking?.slice(0, 8).map(vehicle => {
          const minutes = Math.floor(vehicle.timeToStation / 60);
          const seconds = vehicle.timeToStation % 60;
          const expectedTime = vehicle.expectedArrival ? new Date(vehicle.expectedArrival).toLocaleTimeString() : 'N/A';
          const lastUpdated = vehicle.timestamp ? new Date(vehicle.timestamp).toLocaleTimeString() : 'N/A';
          const positionStatus = getPositionStatus(vehicle);
          const positionSourceText = getPositionSourceText(vehicle);
          const badgeStyle = getPositionBadgeColor(vehicle);
          
          return (
            <div key={vehicle.id} className={`card ${vehicle.operationType === 2 ? 'warning' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0 }}>
                  🚌 {vehicle.lineName} to {vehicle.destinationName || 'Unknown Destination'}
                </h4>
                <span style={{
                  fontSize: '0.7em',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  ...badgeStyle
                }}>
                  {positionStatus}
                </span>
              </div>
              
              {vehicle.routeArea && (
                <div style={{ 
                  margin: '5px 0', 
                  padding: '4px 8px', 
                  background: '#f8f9fa', 
                  borderRadius: '4px',
                  fontSize: '0.9em' 
                }}>
                  <strong>📍 Area:</strong> {vehicle.routeArea}
                  {vehicle.currentLocation && (
                    <span> • <strong>Location:</strong> {vehicle.currentLocation}</span>
                  )}
                </div>
              )}
              
              <div className="vehicle-details">
                {/* Quick Stats Row */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '15px',
                  padding: '10px',
                  background: '#f8f9fa',
                  borderRadius: '4px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#4a6fa5' }}>
                      {minutes > 0 ? `${minutes}m` : `${seconds}s`}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>Arrival Time</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: vehicle.hasRealPosition ? '#28a745' : '#ffc107' }}>
                      {vehicle.hasRealPosition ? 'GPS' : 'EST'}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>Position</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: '#6c757d' }}>
                      {vehicle.vehicleId?.substring(0, 6) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#666' }}>Vehicle ID</div>
                  </div>
                </div>

                {/* Arrival Information */}
                <div className="detail-section">
                  <h5>🕒 Arrival Information</h5>
                  <p><strong>Time to Station:</strong> {minutes > 0 ? `${minutes} min ` : ''}{seconds} sec</p>
                  <p><strong>Expected Arrival:</strong> {expectedTime}</p>
                  {vehicle.timeToLive && (
                    <p><strong>Prediction Expires:</strong> {new Date(vehicle.timeToLive).toLocaleTimeString()}</p>
                  )}
                </div>

                {/* Location Details - Now with improved clickable button */}
                <div className="detail-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h5 style={{ margin: 0 }}>📍 Location Details</h5>
                    <button 
                      className="location-btn"
                      onClick={() => handleViewOnMapClick(vehicle)}
                      title="View this vehicle on the animated map"
                      style={{
                        padding: '6px 12px',
                        background: vehicle.hasRealPosition ? '#28a745' : '#ffc107',
                        color: vehicle.hasRealPosition ? 'white' : '#212529',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.9em',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span>📍</span>
                      <span>View on Map</span>
                    </button>
                  </div>
                  
                  <p><strong>Position Source:</strong> {positionSourceText}</p>
                  <p><strong>Current Stop:</strong> {vehicle.stationName || 'In transit'}</p>
                  <p><strong>Platform/Stop:</strong> {vehicle.platformName || 'N/A'}</p>
                  <p><strong>Towards:</strong> {vehicle.towards || vehicle.destinationName || 'Unknown'}</p>
                  
                  {vehicle.lat && vehicle.lon && (
                    <div style={{ 
                      marginTop: '8px',
                      padding: '6px',
                      background: '#e9ecef',
                      borderRadius: '4px',
                      fontSize: '0.85em'
                    }}>
                      <strong>Coordinates:</strong> {vehicle.lat.toFixed(6)}, {vehicle.lon.toFixed(6)}
                      <br />
                      <small style={{ color: '#6c757d' }}>
                        {vehicle.hasRealPosition 
                          ? 'Real coordinates from TfL API' 
                          : 'Estimated coordinates based on route'}
                      </small>
                    </div>
                  )}
                </div>

                {/* Vehicle & Route Info */}
                <div className="detail-section">
                  <h5>🚌 Vehicle & Route</h5>
                  <p><strong>Vehicle ID:</strong> {vehicle.vehicleId || 'N/A'}</p>
                  <p><strong>Line:</strong> {vehicle.lineName} (ID: {vehicle.lineId})</p>
                  <p><strong>Direction:</strong> {vehicle.direction || 'Unknown'}</p>
                  <p><strong>Bearing:</strong> {vehicle.bearing || 'N/A'}°</p>
                  <p><strong>Mode:</strong> {vehicle.modeName || 'bus'}</p>
                  <p><strong>Vehicle Type:</strong> {vehicle.vehicleType || 'bus'}</p>
                </div>

                {/* Technical Details */}
                <div className="detail-section">
                  <h5>🔧 Technical Details</h5>
                  <p><strong>Operation Type:</strong> {vehicle.operationType === 1 ? 'Active' : 'To be removed'}</p>
                  <p><strong>Stop ID:</strong> {vehicle.naptanId || 'N/A'}</p>
                  <p><strong>Destination ID:</strong> {vehicle.destinationNaptanId || 'N/A'}</p>
                  <p><strong>Last Updated:</strong> {lastUpdated}</p>
                  <p><strong>Data Source:</strong> {vehicle.isRealTime ? 'Real-time TfL API' : 'Simulated data'}</p>
                  <p><strong>Position Source:</strong> {vehicle.positionSource || 'unknown'}</p>
                </div>

                {/* Status Indicator */}
                {vehicle.operationType === 2 && (
                  <div style={{ 
                    background: '#fff3cd', 
                    border: '1px solid #ffeaa7', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginTop: '10px' 
                  }}>
                    <strong>⚠️ Note:</strong> This prediction may be outdated and should be removed from cache
                  </div>
                )}
              </div>
            </div>
          );
        });
      
      default:
        return <div className="card">Select a data category to view information</div>;
    }
  };

  // Add some CSS for the grid layout
  const gridStyles = `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
      padding: 20px;
    }
    
    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 15px;
      transition: transform 0.2s, box-shadow 0.2s;
      border-left: 4px solid #4a6fa5;
    }
    
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    
    .card.good {
      border-left-color: #28a745;
    }
    
    .card.warning {
      border-left-color: #ffc107;
    }
    
    .card.danger {
      border-left-color: #dc3545;
    }
    
    .vehicle-details {
      margin-top: 10px;
    }
    
    .detail-section {
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 1px solid #eee;
    }
    
    .detail-section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    
    .detail-section h5 {
      margin: 0 0 8px 0;
      color: #4a6fa5;
      font-size: 0.95em;
    }
    
    .detail-section p {
      margin: 4px 0;
      font-size: 0.9em;
      color: #555;
    }
    
    .location-btn {
      background: #4a6fa5;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9em;
      transition: background 0.2s;
    }
    
    .location-btn:hover {
      background: #3a5a8a;
    }
  `;

  // Add styles to document
  if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = gridStyles;
    document.head.appendChild(styleSheet);
  }

  return (
    <div className="grid">
      {renderContent()}
    </div>
  );
};

export default TrafficList;