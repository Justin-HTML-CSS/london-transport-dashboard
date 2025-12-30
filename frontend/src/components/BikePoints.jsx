import React, { useState, useEffect } from 'react';

export default function BikePoints({ data }) {
  const [bikePoints, setBikePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBikePoints = async () => {
      try {
        setLoading(true);
        const appId = process.env.REACT_APP_TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.REACT_APP_TFL_APP_ID)}&` : '';
        const appKey = process.env.REACT_APP_TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.REACT_APP_TFL_APP_KEY)}` : '';
        const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
        
        const response = await fetch(`https://api.tfl.gov.uk/BikePoint${authQuery}`);
        if (!response.ok) throw new Error('Failed to fetch bike points');
        const result = await response.json();
        setBikePoints(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBikePoints();
  }, []);

  if (loading) return <div className="tab-content"><p>Loading bike points...</p></div>;
  if (error) return <div className="tab-content"><p>Error: {error}</p></div>;

  return (
    <div className="tab-content">
      <h2>🚴 Bike Points</h2>
      <div className="bike-points-grid">
        {bikePoints.length > 0 ? (
          bikePoints.map(point => (
            <div key={point.id} className="bike-point-card">
              <h3>{point.commonName}</h3>
              <p><strong>Available Bikes:</strong> {point.nbBikes}</p>
              <p><strong>Empty Docks:</strong> {point.nbEmptyDocks}</p>
              <p><strong>Total Capacity:</strong> {point.nbBikes + point.nbEmptyDocks}</p>
              <p><strong>Location:</strong> {point.lat.toFixed(4)}, {point.lon.toFixed(4)}</p>
            </div>
          ))
        ) : (
          <p>No bike points data available</p>
        )}
      </div>
    </div>
  );
}