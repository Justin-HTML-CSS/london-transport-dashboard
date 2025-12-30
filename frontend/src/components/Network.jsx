import React, { useState, useEffect } from 'react';

export default function Network() {
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNetworkData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/network');
        if (!response.ok) throw new Error('Failed to fetch network data');
        const data = await response.json();
        setNetworkData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNetworkData();
  }, []);

  if (loading) return <div className="tab-content"><p>Loading network data...</p></div>;
  if (error) return <div className="tab-content"><p>Error: {error}</p></div>;

  return (
    <div className="tab-content">
      <h2>🌐 Network</h2>
      {networkData ? (
        <div className="network-stats">
          <div className="stat-card">
            <h3>Total Lines</h3>
            <p>{networkData.totalLines || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Total Stations</h3>
            <p>{networkData.totalStations || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Network Status</h3>
            <p>{networkData.status || 'Unknown'}</p>
          </div>
        </div>
      ) : (
        <p>No network data available</p>
      )}
    </div>
  );
}