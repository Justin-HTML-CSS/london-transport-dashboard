import React, { useState, useEffect } from 'react';
import { useLazyQuery, gql, useApolloClient } from '@apollo/client';

const JOURNEY_QUERY = gql`
  query PlanJourney(
    $from: String!
    $to: String!
    $date: String
    $time: String
  ) {
    journeyPlanner(
      from: $from
      to: $to
      date: $date
      time: $time
      timeIs: "departing"
      journeyPreference: "leasttime"
    ) {
      journeys {
        startDateTime
        arrivalDateTime
        duration
        legs {
          duration
          instruction {
            summary
          }
          departureTime
          arrivalTime
          departurePoint {
            lat
            lon
          }
          arrivalPoint {
            lat
            lon
          }
          mode {
            id
            name
          }
          distance
          path {
            lineString
          }
        }
      }
      disambiguationRequired
      fromLocationDisambiguation {
        disambiguationOptions {
          parameterValue
          place {
            commonName
            lat
            lon
            placeType
          }
          matchQuality
        }
      }
      toLocationDisambiguation {
        disambiguationOptions {
          parameterValue
          place {
            commonName
            lat
            lon
            placeType
          }
          matchQuality
        }
      }
    }
  }
`;

const JourneyPlanner = ({ onRouteSelect }) => {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    via: '',
    date: new Date().toISOString().split('T')[0].replace(/-/g, ''),
    time: new Date().toTimeString().slice(0, 5).replace(':', ''),
    timeIs: 'departing',
    journeyPreference: 'leasttime',
    mode: ['tube', 'bus', 'overground', 'dlr', 'walking'],
    maxWalkingMinutes: 30,
    walkingSpeed: 'average',
    useRealTimeLiveArrivals: true
  });

  const [selectedFromOption, setSelectedFromOption] = useState(null);
  const [selectedToOption, setSelectedToOption] = useState(null);
  const [planJourney, { loading, error, data }] = useLazyQuery(JOURNEY_QUERY);
  const [journeyErrorMessage, setJourneyErrorMessage] = useState(null);
  const client = useApolloClient();

  // Removed backend pre-validation so planner will request TfL data for any location

  // Use useEffect for side effects instead of onCompleted/onError
  useEffect(() => {
    if (error) {
      // Log a concise error message only (avoid full Apollo stack spam)
      const msg = error?.message || 'Unknown GraphQL error';
      console.error('❌ GraphQL Error:', msg);
      setJourneyErrorMessage(msg);
    } else {
      setJourneyErrorMessage(null);
    }
  }, [error]);

  useEffect(() => {
    if (data) {
      console.log('✅ Journey data received:', data);
    }
  }, [data]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔄 Form submitted with data:', formData);
    
    // Basic validation
    if (!formData.from.trim() || !formData.to.trim()) {
      console.error('❌ Form validation failed: From and To fields are required');
      return;
    }

    // If we have selected disambiguation options, use them
    const fromValue = selectedFromOption || formData.from;
    const toValue = selectedToOption || formData.to;

    // No pre-validation: send request for any provided locations
    
    console.log('🚀 Making GraphQL request with:', { 
      from: fromValue, 
      to: toValue,
      date: formData.date,
      time: formData.time
    });
    setJourneyErrorMessage(null);
    planJourney({ 
      variables: { 
        from: fromValue,
        to: toValue,
        date: formData.date,
        time: formData.time
      } 
    }).catch(err => {
      const msg = err?.message || 'Journey planning failed';
      console.error('❌ Plan request failed:', msg);
      setJourneyErrorMessage(msg);
    });
  };

  const handleInputChange = (field, value) => {
    console.log(`📝 Field ${field} changed to:`, value);
    setFormData(prev => ({ ...prev, [field]: value }));
    // Reset disambiguation selections when inputs change
    if (field === 'from') setSelectedFromOption(null);
    if (field === 'to') setSelectedToOption(null);
    // Clear previous backend validation for that field so validation will re-run on next error
    if (field === 'from') setFromValidation(null);
    if (field === 'to') setToValidation(null);
  };

  const handleDisambiguationSelect = async (type, option) => {
    console.log(`📍 Disambiguation selected: ${type}`, option);
    // Accept the selected disambiguation option and plan using it
    const fromValue = type === 'from' ? option.parameterValue : (selectedFromOption || formData.from);
    const toValue = type === 'to' ? option.parameterValue : (selectedToOption || formData.to);
    if (type === 'from') setSelectedFromOption(option.parameterValue);
    else setSelectedToOption(option.parameterValue);
    setJourneyErrorMessage(null);
    planJourney({ 
      variables: { 
        from: fromValue,
        to: toValue,
        date: formData.date,
        time: formData.time
      } 
    }).catch(err => {
      const msg = err?.message || 'Journey planning failed';
      console.error('❌ Plan request failed (disambiguation):', msg);
      setJourneyErrorMessage(msg);
    });
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatTime = (dateTimeStr) => {
    return new Date(dateTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if we need to show disambiguation
  const showFromDisambiguation = data?.journeyPlanner?.disambiguationRequired && data.journeyPlanner.fromLocationDisambiguation;
  const showToDisambiguation = data?.journeyPlanner?.disambiguationRequired && data.journeyPlanner.toLocationDisambiguation;

  // Extract disambiguation option arrays (may be empty)
  const fromDisambiguationOptions = data?.journeyPlanner?.fromLocationDisambiguation?.disambiguationOptions || [];
  const toDisambiguationOptions = data?.journeyPlanner?.toLocationDisambiguation?.disambiguationOptions || [];

  // Check if input is a complete UK postcode (e.g., "SE5 8RW") vs incomplete (e.g., "e11")
  const isCompletePostcode = (input) => {
    // UK postcode pattern: 1-2 letters, 1-2 digits, optional letter, space, digit, 2 letters
    // Examples: SE5 8RW, E1 7PT, M1 1AA
    const postcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;
    return postcodeRegex.test(input.trim());
  };

  // Check if input looks like a partial postcode (starts like a postcode but incomplete)
  const isPartialPostcode = (input) => {
    // Partial postcode: starts with 1-2 letters followed by digits, but doesn't match complete pattern
    const partialPostcodeRegex = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?$/i;
    return partialPostcodeRegex.test(input.trim()) && !isCompletePostcode(input);
  };

  const fromIsValidPostcode = isCompletePostcode(formData.from);
  const toIsValidPostcode = isCompletePostcode(formData.to);

  // Validation results from backend (uses TfL / geocoding to determine if location is within TfL coverage)
  const [fromValidation, setFromValidation] = useState(null); // { found, lat, lon, inLondon }
  const [toValidation, setToValidation] = useState(null);

  // Only highlight fields with SPECIFIC evidence of being invalid:
  // 1) Valid postcode format but disambiguation returns zero results (TfL location not found)
  // 2) Backend validateLocation confirms the place is not within TfL coverage (inLondon === false)
  // 3) Invalid postcode format AND there's an error
  const fromHasEmptyDisambiguation = data?.journeyPlanner?.disambiguationRequired && fromDisambiguationOptions.length === 0 && formData.from.trim() && !fromIsValidPostcode;
  const toHasEmptyDisambiguation = data?.journeyPlanner?.disambiguationRequired && toDisambiguationOptions.length === 0 && formData.to.trim() && !toIsValidPostcode;

  // If the overall journey request failed (general TfL range error), run backend validation to see which field is actually outside TfL coverage.
  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      if (!(error || journeyErrorMessage)) return;
      try {
        // Validate 'from' if present
        if (formData.from && formData.from.trim()) {
          const resp = await client.query({
            query: gql`query ValidateLocation($name: String!){ validateLocation(name: $name){ input found lat lon inLondon } }`,
            variables: { name: formData.from },
            fetchPolicy: 'network-only'
          });
          if (!cancelled) setFromValidation(resp?.data?.validateLocation || null);
        }
        // Validate 'to' if present
        if (formData.to && formData.to.trim()) {
          const resp2 = await client.query({
            query: gql`query ValidateLocation($name: String!){ validateLocation(name: $name){ input found lat lon inLondon } }`,
            variables: { name: formData.to },
            fetchPolicy: 'network-only'
          });
          if (!cancelled) setToValidation(resp2?.data?.validateLocation || null);
        }
      } catch (err) {
        console.warn('⚠️ validateLocation check failed:', err.message);
      }
    };

    validate();
    return () => { cancelled = true; };
  // Intentionally run when we have a general error and inputs available
  }, [error, journeyErrorMessage, formData.from, formData.to, client]);

  // Mark input as error ONLY if we have specific evidence that THIS field is the problem:
  // 1) Empty disambiguation results (TfL can't find the location)
  // 2) Validation confirms location is outside TfL coverage
  // 3) Invalid postcode format AND general error
  const fromInputErrorStyle = (fromHasEmptyDisambiguation || (fromValidation && fromValidation.found && fromValidation.inLondon === false) || (!fromIsValidPostcode && (error || journeyErrorMessage) && !selectedFromOption && formData.from.trim()))
    ? { border: '2px solid #dc3545', boxShadow: '0 0 0 3px rgba(220,53,69,0.25)', backgroundColor: '#fff5f5' }
    : undefined;
  const toInputErrorStyle = (toHasEmptyDisambiguation || (toValidation && toValidation.found && toValidation.inLondon === false) || (!toIsValidPostcode && (error || journeyErrorMessage) && !selectedToOption && formData.to.trim()))
    ? { border: '2px solid #dc3545', boxShadow: '0 0 0 3px rgba(220,53,69,0.25)', backgroundColor: '#fff5f5' }
    : undefined;

  // Debug logging to help identify why fields are being highlighted
  useEffect(() => {
    if (!(error || journeyErrorMessage)) return;
    console.log('🔍 Journey validation state:', {
      from: {
        value: formData.from,
        isCompletePostcode: fromIsValidPostcode,
        hasEmptyDisambiguation: fromHasEmptyDisambiguation,
        validation: fromValidation
      },
      to: {
        value: formData.to,
        isCompletePostcode: toIsValidPostcode,
        hasEmptyDisambiguation: toHasEmptyDisambiguation,
        validation: toValidation
      },
      journeyErrorMessage
    });
  }, [error, journeyErrorMessage, formData.from, formData.to, fromIsValidPostcode, toIsValidPostcode, fromHasEmptyDisambiguation, toHasEmptyDisambiguation, fromValidation, toValidation]);

  // Check if journey has map data
  const hasMapData = (journey) => {
    return journey.legs?.some(leg => 
      leg.path?.lineString || 
      (leg.departurePoint?.lat && leg.arrivalPoint?.lat)
    );
  };

  return (
    <div className="journey-planner-data-grid">
      <div className="journey-form-section">
        <h2>Plan Your Journey</h2>
        <div className="sub-title">Powered by TFL Api</div>
        
        <form onSubmit={handleSubmit} className="journey-form">
          <div className="form-row">
            <div className="form-group">
              <label>From:</label>
              <input
                type="text"
                name="from"
                className={(fromHasEmptyDisambiguation || (fromValidation && fromValidation.found && fromValidation.inLondon === false) || (!fromIsValidPostcode && (error || journeyErrorMessage) && !selectedFromOption && formData.from.trim())) ? 'input-error' : ''}
                style={fromInputErrorStyle}
                value={selectedFromOption ? `Selected: ${data?.journeyPlanner?.fromLocationDisambiguation?.disambiguationOptions?.find(opt => opt.parameterValue === selectedFromOption)?.place?.commonName || selectedFromOption}` : formData.from}
                onChange={(e) => handleInputChange('from', e.target.value)}
                placeholder="e.g., Greater London location or full postcode"
                required
                disabled={selectedFromOption}
              />
              {selectedFromOption && (
                <button 
                  type="button" 
                  className="clear-selection"
                  onClick={() => setSelectedFromOption(null)}
                >
                  Change
                </button>
              )}
            </div>
            
            <div className="form-group">
              <label>To:</label>
              <input
                type="text"
                name="to"
                className={(toHasEmptyDisambiguation || (toValidation && toValidation.found && toValidation.inLondon === false) || (!toIsValidPostcode && (error || journeyErrorMessage) && !selectedToOption && formData.to.trim())) ? 'input-error' : ''}
                style={toInputErrorStyle}
                value={selectedToOption ? `Selected: ${data?.journeyPlanner?.toLocationDisambiguation?.disambiguationOptions?.find(opt => opt.parameterValue === selectedToOption)?.place?.commonName || selectedToOption}` : formData.to}
                onChange={(e) => handleInputChange('to', e.target.value)}
                placeholder="e.g., Greater London location or full postcode"
                required
                disabled={selectedToOption}
              />
              {selectedToOption && (
                <button 
                  type="button" 
                  className="clear-selection"
                  onClick={() => setSelectedToOption(null)}
                >
                  Change
                </button>
              )}
            </div>
          </div>

          {/* Show disambiguation options if needed */}
          {showFromDisambiguation && !selectedFromOption && (
            <div className={`disambiguation-section ${fromIsValidPostcode ? 'success' : ''}`}>
              {fromIsValidPostcode ? (
                <>
                  <h4>📍 Postcode successfully found "{formData.from}"</h4>
                  <p></p>
                </>
              ) : isPartialPostcode(formData.from) ? (
                <>
                  <h4>📍 "{formData.from}" Incomplete postcode:</h4>
                </>
              ) : (
                <>
                  <h4>📍 Multiple matches found for "{formData.from}"</h4>
                  <p>Please select one:</p>
                </>
              )}
                  <div className="disambiguation-options">
                    {fromDisambiguationOptions.length === 0 ? (
                      fromIsValidPostcode ? null : (
                        <div className="no-matches">No matches found for "{formData.from}"</div>
                      )
                    ) : (
                      fromDisambiguationOptions.slice(0, 5).map((option, index) => {
                        const raw = option?.place?.commonName || option?.parameterValue || '';
                        let label = raw;
                        try { label = decodeURIComponent(raw); } catch (e) { /* ignore */ }
                        const typeLabel = option?.place?.placeType || 'StopPoint';
                        const meaningful = /[A-Za-z0-9]/.test(label || '');
                        const fallbackMsg = "Your request includes locations outside TfL's range";
                        return (
                          <div 
                            key={index} 
                            className="disambiguation-option"
                            onClick={() => handleDisambiguationSelect('from', option)}
                          >
                            <div className="option-name">{meaningful ? label : fallbackMsg}</div>
                            <div className="option-type">{typeLabel}</div>
                            <div className="option-quality">Match: {option.matchQuality}/1000</div>
                          </div>
                        );
                      })
                    )}
                  </div>
            </div>
          )}

          {showToDisambiguation && !selectedToOption && (
            <div className={`disambiguation-section ${toIsValidPostcode ? 'success' : ''}`}>
              {toIsValidPostcode ? (
                <>
                  <h4>📍 Postcode successfully found "{formData.to}"</h4>
                  <p></p>
                </>
              ) : isPartialPostcode(formData.to) ? (
                <>
                  <h4>📍 "{formData.to}" Incomplete postcode:</h4>
                </>
              ) : (
                <>
                  <h4>📍 Multiple matches found for "{formData.to}"</h4>
                  <p>Please select one:</p>
                </>
              )}
              <div className="disambiguation-options">
                {toDisambiguationOptions.length === 0 ? (
                  toIsValidPostcode ? null : (
                    <div className="no-matches">No matches found for "{formData.to}"</div>
                  )
                ) : (
                  toDisambiguationOptions.slice(0, 5).map((option, index) => {
                    const raw = option?.place?.commonName || option?.parameterValue || '';
                    let label = raw;
                    try { label = decodeURIComponent(raw); } catch (e) { /* ignore */ }
                    const typeLabel = option?.place?.placeType || 'StopPoint';
                    const meaningful = /[A-Za-z0-9]/.test(label || '');
                    const fallbackMsg = "Your request includes locations outside TfL's range";
                    return (
                      <div 
                        key={index} 
                        className="disambiguation-option"
                        onClick={() => handleDisambiguationSelect('to', option)}
                      >
                        <div className="option-name">{meaningful ? label : fallbackMsg}</div>
                        <div className="option-type">{typeLabel}</div>
                        <div className="option-quality">Match: {option.matchQuality}/1000</div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Date:</label>
              <input
                type="date"
                name="date"
                value={formData.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')}
                onChange={(e) => handleInputChange('date', e.target.value.replace(/-/g, ''))}
              />
            </div>
            
            <div className="form-group">
              <label>Time:</label>
              <input
                type="time"
                name="time"
                value={formData.time.replace(/(\d{2})(\d{2})/, '$1:$2')}
                onChange={(e) => handleInputChange('time', e.target.value.replace(':', ''))}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={loading ? 'loading' : ''}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Planning...
              </>
            ) : (
              'Plan Journey'
            )}
          </button>
          {loading && (
            <div className="loading-message">
              🔄 Finding journey options from {formData.from} to {formData.to}...
            </div>
          )}

          {/* Coverage warnings removed — planner will request data for any location */}
        </form>

        { ( (error || journeyErrorMessage) && !data?.journeyPlanner?.disambiguationRequired ) && (
          <div className="error-card">
            <h4>Your request includes locations outside TfL's range</h4>
            <p>Try again</p>
          </div>
        )}
      </div>

      {data?.journeyPlanner?.journeys && data.journeyPlanner.journeys.length > 0 && (
        <div className="journey-results-section">
          
          <div className="journeyOptions"><h4>Journey Options ({data.journeyPlanner.journeys.length} found)</h4></div>
          
          <div className="journey-results-grid">
            {data.journeyPlanner.journeys.map((journey, index) => (
              <div key={index} className="journey-card">
                <div className="journey-header">
                  <h5>Option {index + 1}</h5>
                  <div className="journey-meta">
                    
                  </div>
                </div>
                
                <div className="journey-legs">
                  {journey.legs?.map((leg, legIndex) => (
                    <div key={legIndex} className={`leg ${leg.isDisrupted ? 'disrupted' : ''}`}>
                      <div className="leg-mode">
                        <span className="mode-icon">{getModeIcon(leg.mode?.id)}</span>
                        <span className="mode-name">{leg.mode?.name || 'Unknown'}</span>
                        <span className="leg-duration">{formatDuration(leg.duration)}</span>
                      </div>
                      
                      <div className="leg-details">
                        <p><strong>{leg.instruction?.summary || 'No details available'}</strong></p>
                        <p>{formatTime(leg.departureTime)} → {formatTime(leg.arrivalTime)}</p>
                        {leg.distance && <p>Distance: {(leg.distance / 1000).toFixed(1)}km</p>}
                      </div>
                      
                      {leg.isDisrupted && (
                        <div className="disruption-warning">
                          ⚠️ Service disruptions may affect this leg
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <button 
                  className="view-route-btn"
                    onClick={() => {
                      console.log('🗺️ Viewing journey in modal:', journey);
                    onRouteSelect && onRouteSelect(journey);
                    }}
                  title={hasMapData(journey) ? "View this route in detail" : "Limited map data available for this route"}
                >
                    View Detailed Route
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function for mode icons
const getModeIcon = (modeId) => {
  const icons = {
    'tube': '🚇',
    'bus': '🚌',
    'overground': '🚆',
    'dlr': '🚈',
    'tram': '🚊',
    'walking': '🚶',
    'cycle': '🚴',
    'river-bus': '⛴️',
    'national-rail': '🚄'
  };
  return icons[modeId] || '📍';
};

export default JourneyPlanner;