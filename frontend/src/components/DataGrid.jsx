import React from 'react';

const DataGrid = ({ data, selectedTab }) => {
  if (!data) return null;

  const renderContent = () => {
    switch (selectedTab) {
      case 'lines':
        return data.lineStatus.map(line => (
          <div key={line.id} className="card">
            <h4>{line.name} ({line.modeName})</h4>
            <p>{line.lineStatuses[0]?.statusSeverityDescription}</p>
          </div>
        ));
      case 'accidents':
        return data.accidentStats.slice(0, 6).map(accident => (
          <div key={accident.id} className="card danger">
            <h4>Accident in {accident.borough}</h4>
            <p>Severity: {accident.severity}</p>
          </div>
        ));
      default:
        return <div>Select a category</div>;
    }
  };

  return (
    <div className="data-grid">
      <div className="grid">
        {renderContent()}
      </div>
    </div>
  );
};

export default DataGrid;