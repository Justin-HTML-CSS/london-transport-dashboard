import React, { useState, useEffect } from 'react';

export default function Accidents() {
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccidents = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/accidents');
        if (!response.ok) throw new Error('Failed to fetch accidents');
        const data = await response.json();
        setAccidents(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAccidents();
  }, []);

  if (loading) return <div className="tab-content"><p>Loading accidents data...</p></div>;
  if (error) return <div className="tab-content"><p>Error: {error}</p></div>;

  return (
    <div className="tab-content">
      <h2>⚠️ Accidents</h2>
      <div className="accidents-list">
        {accidents.length > 0 ? (
          accidents.map((accident, idx) => (
            <div key={idx} className="accident-item">
              <h3>{accident.location}</h3>
              <p>{accident.description}</p>
              <p className="timestamp">{new Date(accident.date).toLocaleString()}</p>
            </div>
          ))
        ) : (
          <p>No accident reports available</p>
        )}
      </div>
    </div>
  );
}