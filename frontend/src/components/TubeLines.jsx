import React, { useState, useEffect } from 'react';

export default function TubeLines({ data }) {
  const [tubeLines, setTubeLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTubeLines = async () => {
      try {
        setLoading(true);
        const appId = process.env.REACT_APP_TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.REACT_APP_TFL_APP_ID)}&` : '';
        const appKey = process.env.REACT_APP_TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.REACT_APP_TFL_APP_KEY)}` : '';
        const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
        
        const response = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube${authQuery}`);
        if (!response.ok) throw new Error('Failed to fetch tube lines');
        const result = await response.json();
        setTubeLines(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTubeLines();
  }, []);

  if (loading) return <div className="tab-content"><p>Loading tube lines...</p></div>;
  if (error) return <div className="tab-content"><p>Error: {error}</p></div>;

  return (
    <div className="tab-content">
      <h2>🚊 Tube Lines</h2>
      <div className="tube-lines-grid">
        {tubeLines.length > 0 ? (
          tubeLines.map(line => (
            <div key={line.id} className="tube-line-card" style={{ borderLeftColor: line.lineColour || '#ccc' }}>
              <h3>{line.name}</h3>
              <p><strong>ID:</strong> {line.id}</p>
              <p><strong>Status:</strong> {line.lineStatuses?.[0]?.statusSeverityDescription || 'Unknown'}</p>
              {line.lineStatuses?.[0]?.reason && <p><strong>Reason:</strong> {line.lineStatuses[0].reason}</p>}
            </div>
          ))
        ) : (
          <p>No tube lines data available</p>
        )}
      </div>
    </div>
  );
}