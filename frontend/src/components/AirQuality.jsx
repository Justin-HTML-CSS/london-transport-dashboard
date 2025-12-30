import React, { useState, useEffect } from 'react';

export default function AirQuality() {
  const [airQuality, setAirQuality] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAirQuality = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/air-quality');
        if (!response.ok) throw new Error('Failed to fetch air quality data');
        const data = await response.json();
        setAirQuality(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAirQuality();
  }, []);

  if (loading) return <div className="tab-content"><p>Loading air quality data...</p></div>;
  if (error) return <div className="tab-content"><p>Error: {error}</p></div>;

  return (
    <div className="tab-content">
      <h2>💨 Air Quality</h2>
      {airQuality ? (
        <div className="air-quality-container">
          <div className="air-quality-card">
            <h3>Overall Air Quality Index</h3>
            <p className="aqi-value">{airQuality.aqi}</p>
            <p className="aqi-status">{airQuality.status}</p>
          </div>
          <div className="pollutants-grid">
            {airQuality.pollutants && Object.entries(airQuality.pollutants).map(([key, value]) => (
              <div key={key} className="pollutant-card">
                <h4>{key.toUpperCase()}</h4>
                <p>{value} µg/m³</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>No air quality data available</p>
      )}
    </div>
  );
}