import React from 'react';

const TrafficStats = ({ data }) => {
  if (!data) return <div>Loading stats...</div>;

  const getActiveDisruptions = () => {
    if (!data.roadStatus) return 0;
    return data.roadStatus.filter(road => road.statusSeverity < 10).length;
  };

  return (
    <div className="data-summary">
      <h3>Transport Statistics</h3>
      
      {data.lineStatus && (
        <div className="summary-section">
          <h4>Tube Lines Status</h4>
          {data.lineStatus.slice(0, 5).map(line => (
            <div key={line.id} className="summary-item">
              <span className="line-name">{line.name}</span>
              <span className={`status-dot ${line.lineStatuses[0]?.statusSeverity >= 10 ? 'good' : 'warning'}`}></span>
            </div>
          ))}
        </div>
      )}
      
      {data.roadStatus && (
        <div className="summary-section">
          <h4>Road Status</h4>
          <p>Active Disruptions: {getActiveDisruptions()}</p>
          <p>Total Roads Monitored: {data.roadStatus.length}</p>
        </div>
      )}
      
      {data.accidentStats && (
        <div className="summary-section">
          <h4>Accident Summary</h4>
          <p>Total Accidents: {data.accidentStats.length}</p>
        </div>
      )}
      
      {data.bikePoints && (
        <div className="summary-section">
          <h4>Bike Availability</h4>
          <p>Total Bike Points: {data.bikePoints.length}</p>
        </div>
      )}
    </div>
  );
};

export default TrafficStats;