import dotenv from 'dotenv';
dotenv.config();

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import axios from 'axios';
import { getLiveVehicles, startCacheCleanup, getStopPointCoordinates, validateLocation as validateLocationService } from './tflService.js';

// ========== TFL API CREDENTIALS ==========
const TFL_APP_ID = process.env.TFL_APP_ID || '20d4212820254655aa1b8caeaa74e237';
const TFL_APP_KEY = process.env.TFL_APP_KEY || '4a784eea91d24c16a6c89840a87f15bb';

// ========== SIMULATED VEHICLE DATA STORAGE ==========
let simulatedVehicles = [];
let lastUpdateTime = Date.now();

// Initialize simulated vehicles
function initializeSimulatedVehicles() {
  console.log('🚗 Initializing simulated vehicles...');
  simulatedVehicles = getRealisticVehicleDataAlongRoutes();
  console.log(`✅ Initialized ${simulatedVehicles.length} simulated vehicles`);
}

// Update vehicle positions every 5 seconds
function startVehicleSimulation() {
  setInterval(() => {
    simulatedVehicles = simulatedVehicles.map(vehicle => {
      // Move vehicle based on heading and speed
      const headingRad = (vehicle.heading * Math.PI) / 180;
      const latMove = Math.cos(headingRad) * vehicle.speed * 0.00001;
      const lonMove = Math.sin(headingRad) * vehicle.speed * 0.00001;
      
      // Random small variation
      const randomLat = (Math.random() - 0.5) * 0.00001;
      const randomLon = (Math.random() - 0.5) * 0.00001;
      
      // Bounce off bounds
      let newLat = vehicle.lat + latMove + randomLat;
      let newLon = vehicle.lon + lonMove + randomLon;
      let newHeading = vehicle.heading;
      
      if (newLat < 51.3 || newLat > 51.7 || newLon < -0.5 || newLon > 0.2) {
        newHeading = (vehicle.heading + 180) % 360;
        newLat = vehicle.lat;
        newLon = vehicle.lon;
      }
      
      return {
        ...vehicle,
        lat: newLat,
        lon: newLon,
        heading: newHeading,
        lastUpdated: new Date().toISOString(),
        timeToStation: Math.max(30, vehicle.timeToStation - 5 + (Math.random() * 10))
      };
    });
    
    lastUpdateTime = Date.now();
  }, 5000);
}

const typeDefs = `#graphql
  type LineRouteSequence {
    lineId: String
    lineName: String
    direction: String
    mode: String
    lineStrings: [String]
    stations: [Station]
  }

  type Station {
    id: String
    name: String
    lat: Float
    lon: Float
  }

  type StopPointSequence {
    lineId: String
    lineName: String
    direction: String
    branchId: Int
    stopPoint: [StopPoint]
  }

  type StopPoint {
    id: String
    name: String
    lat: Float
    lon: Float
  }

  type LineGeometry {
    lineId: String
    lineName: String
    mode: String
    outbound: LineRouteSequence
    inbound: LineRouteSequence
  }

  type Query {
    id: String!
    testMessage: String!
    bikePoints: [BikePoint!]
    lineStatus: [LineStatus!]
    accidentStats(year: Int!): [AccidentDetail!]
    roadStatus: [RoadStatus!]
    airQuality: AirQuality
    networkStatus: [NetworkStatus!]
    vehicleArrivals(vehicleIds: [String!]): [VehicleArrival!]
    vehicleTracking(routeIds: [String!]): [VehicleArrival!]
    busArrivals: [VehicleArrival!]
    journeyPlanner(
      from: String!
      to: String!
      via: String
      date: String
      time: String
      timeIs: String
      journeyPreference: String
      mode: [String]
      maxWalkingMinutes: Int
      walkingSpeed: String
      useRealTimeLiveArrivals: Boolean
    ): JourneyResponse
    lineGeometry(lineId: String!): LineGeometry
    simulatedVehicles: [VehicleArrival!]
    selectedVehiclePosition(vehicleId: String!): VehiclePositionUpdate
    validateLocation(name: String!): LocationValidation
  }

  type BikePoint {
    id: String!
    name: String!
    lat: Float!
    lon: Float!
    bikes: Int
    emptyDocks: Int
    totalDocks: Int
  }

  type LineStatus {
    id: String!
    name: String!
    modeName: String!
    lineStatuses: [StatusDetail!]!
  }

  type StatusDetail {
    statusSeverity: Int!
    statusSeverityDescription: String!
    reason: String
  }

  type AccidentDetail {
    id: Int!
    lat: Float!
    lon: Float!
    location: String!
    severity: String!
    borough: String!
  }

  type RoadStatus {
    id: String!
    displayName: String!
    statusSeverity: Int!
    statusSeverityDescription: String!
    disruptionDetails: String
    location: String
    startDateTime: String
    endDateTime: String
  }

  type AirQuality {
    currentForecast: [Forecast!]!
  }

  type Forecast {
    forecastBand: String!
    forecastSummary: String!
  }

  type NetworkStatus {
    id: String!
    name: String!
    modeName: String!
    lineStatuses: [StatusDetail!]!
  }

  type VehicleArrival {
    id: String!
    operationType: Int!
    vehicleId: String!
    naptanId: String!
    stationName: String!
    lineId: String!
    lineName: String!
    platformName: String!
    direction: String!
    bearing: String!
    destinationNaptanId: String!
    destinationName: String!
    timestamp: String!
    timeToStation: Int!
    currentLocation: String!
    towards: String!
    expectedArrival: String!
    timeToLive: String!
    modeName: String!
    timing: TimingData
    lat: Float!
    lon: Float!
    vehicleType: String
    isRealTime: Boolean
    routeArea: String
    heading: Int
    speed: Float
    lastUpdated: String
    hasRealPosition: Boolean
    positionSource: String
  }

  type VehiclePositionUpdate {
    vehicleId: String!
    lineId: String!
    lineName: String!
    lat: Float!
    lon: Float!
    currentLocation: String!
    timeToStation: Int!
    heading: Int!
    lastUpdated: String!
    hasRealPosition: Boolean!
    positionSource: String!
  }

  type TimingData {
    countdownServerAdjustment: String
    source: String
    insert: String
    read: String
    sent: String
    received: String
  }
  
  type JourneyResponse {
    journeys: [Journey]
    lines: [Line]
    stopMessages: [String]
    recommendedMaxAgeMinutes: Int
    searchCriteria: SearchCriteria
    journeyVector: JourneyVector
    disambiguationRequired: Boolean
    fromLocationDisambiguation: DisambiguationResult
    toLocationDisambiguation: DisambiguationResult
  }

  type DisambiguationResult {
    disambiguationOptions: [DisambiguationOption!]
  }

  type DisambiguationOption {
    parameterValue: String!
    place: Place!
    matchQuality: Int!
  }

  type Place {
    commonName: String!
    lat: Float
    lon: Float
    placeType: String
  }

  type Journey {
    startDateTime: String
    arrivalDateTime: String
    duration: Int
    legs: [Leg]
    fare: Fare
  }

  type Leg {
    duration: Int
    speed: String
    instruction: Instruction
    departureTime: String
    arrivalTime: String
    departurePoint: Point
    arrivalPoint: Point
    path: Path
    routeOptions: [RouteOption]
    mode: Mode
    disruptions: [Disruption]
    distance: Float
    isDisrupted: Boolean
  }

  type Instruction {
    summary: String
    detailed: String
    steps: [Step]
  }

  type Step {
    description: String
    turnDirection: String
    streetName: String
    distance: Int
    cumulativeDistance: Int
    skyDirection: Int
    skyDirectionDescription: String
    cumulativeTravelTime: Int
    latitude: Float
    longitude: Float
    pathAttribute: PathAttribute
    descriptionHeading: String
    trackType: String
  }

  type PathAttribute {
    name: String
    value: String
  }

  type Point {
    lat: Float
    lon: Float
  }

  type Path {
    lineString: String
    stopPoints: [StopPoint]
    elevation: [Elevation]
  }

  type Elevation {
    distance: Int
    startLat: Float
    startLon: Float
    endLat: Float
    endLon: Float
    startElevation: Int
    heightFromPreviousPoint: Int
    gradient: Float
  }

  type RouteOption {
    id: String
    name: String
    directions: [String]
  }

  type Mode {
    id: String
    name: String
    uri: String
    type: String
  }

  type Disruption {
    category: String
    type: String
    categoryDescription: String
    description: String
    summary: String
    additionalInfo: String
    affectedRoutes: [AffectedRoute]
  }

  type AffectedRoute {
    id: String
    lineId: String
    routeCode: String
    name: String
    direction: String
    originationName: String
    destinationName: String
  }

  type Fare {
    totalCost: Int
    fares: [FareDetail]
    caveats: [FareCaveat]
  }

  type FareDetail {
    lowZone: Int
    highZone: Int
    cost: Int
    chargeProfileName: String
    isHopperFare: Boolean
    chargeLevel: String
    peak: Int
    offPeak: Int
  }

  type FareCaveat {
    text: String
    type: String
  }

  type Line {
    id: String
    name: String
    modeName: String
    disruptions: [Disruption]
    lineStatuses: [LineStatusDetail]
  }

  type LineStatusDetail {
    id: Int
    lineId: String
    statusSeverity: Int
    statusSeverityDescription: String
    reason: String
  }

  type SearchCriteria {
    dateTime: String
    dateTimeType: String
  }

  type JourneyVector {
    from: String
    to: String
    via: String
    uri: String
  }
  
  type LocationValidation {
    input: String
    found: Boolean
    lat: Float
    lon: Float
    inLondon: Boolean
  }
`;

const resolvers = {
  Query: {
    id: () => "london-transport-dashboard-api",
    testMessage: () => "🚀 GraphQL Server is WORKING!",
    
    simulatedVehicles: async () => {
      console.log(`📡 Returning ${simulatedVehicles.length} simulated vehicles`);
      return simulatedVehicles;
    },
    
    selectedVehiclePosition: async (_, { vehicleId }) => {
      try {
        console.log(`📍 Fetching updated position for selected vehicle: ${vehicleId}`);
        
        // Try to get fresh data from TfL for this specific vehicle
        const response = await fetch(
          `https://api.tfl.gov.uk/Vehicle/${vehicleId}/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`
        );
        
        if (response.ok) {
          const arrivals = await response.json();
          if (arrivals.length > 0) {
            const arrival = arrivals[0];
            
            // Generate coordinates from text location or route
            let coordinates;
            if (arrival.currentLocation) {
              coordinates = getCoordinatesFromLocationText(
                arrival.currentLocation,
                arrival.lineId,
                arrival.direction
              );
            } else {
              coordinates = generateRouteBasedCoordinates(arrival.lineId, arrival.direction);
            }
            
            const area = getAreaFromCoordinates(coordinates.lat, coordinates.lon);
            
            return {
              vehicleId: arrival.vehicleId,
              lineId: arrival.lineId,
              lineName: arrival.lineName,
              lat: coordinates.lat,
              lon: coordinates.lon,
              currentLocation: arrival.currentLocation || `Route ${arrival.lineId}, ${area}`,
              timeToStation: arrival.timeToStation ? Math.floor(arrival.timeToStation) : 120,
              heading: arrival.bearing ? parseInt(arrival.bearing) : Math.floor(Math.random() * 360),
              lastUpdated: arrival.timestamp || new Date().toISOString(),
              hasRealPosition: true,
              positionSource: arrival.currentLocation ? 'text_location' : 'route_based'
            };
          }
        }
        
        // Check simulated vehicles
        const simulatedVehicle = simulatedVehicles.find(v => v.vehicleId === vehicleId);
        if (simulatedVehicle) {
          return {
            vehicleId: simulatedVehicle.vehicleId,
            lineId: simulatedVehicle.lineId,
            lineName: simulatedVehicle.lineName,
            lat: simulatedVehicle.lat,
            lon: simulatedVehicle.lon,
            currentLocation: simulatedVehicle.currentLocation,
            timeToStation: Math.floor(simulatedVehicle.timeToStation || 120),
            heading: simulatedVehicle.heading,
            lastUpdated: simulatedVehicle.lastUpdated,
            hasRealPosition: false,
            positionSource: 'simulated'
          };
        }
        
        // Fallback
        const coordinates = generateRouteBasedCoordinates('1', 'inbound');
        return {
          vehicleId: vehicleId,
          lineId: '1',
          lineName: '1',
          lat: coordinates.lat,
          lon: coordinates.lon,
          currentLocation: 'Central London',
          timeToStation: 120,
          heading: 180,
          lastUpdated: new Date().toISOString(),
          hasRealPosition: false,
          positionSource: 'fallback'
        };
        
      } catch (error) {
        console.log('❌ Error fetching selected vehicle position:', error.message);
        const coordinates = generateRouteBasedCoordinates('1', 'inbound');
        return {
          vehicleId: vehicleId,
          lineId: '1',
          lineName: '1',
          lat: coordinates.lat,
          lon: coordinates.lon,
          currentLocation: 'Location unavailable',
          timeToStation: 120,
          heading: 180,
          lastUpdated: new Date().toISOString(),
          hasRealPosition: false,
          positionSource: 'error_fallback'
        };
      }
    },

    bikePoints: async () => {
      try {
        console.log('🔵 Testing Bike API...');
        const response = await fetch(`https://api.tfl.gov.uk/BikePoint?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`);
        console.log('Bike API Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Bike API SUCCESS - Got data');
          return data.slice(0, 10).map(point => ({
            id: point.id,
            name: point.commonName,
            lat: point.lat,
            lon: point.lon,
            bikes: parseInt(point.additionalProperties?.find(p => p.key === 'NbBikes')?.value || '0'),
            emptyDocks: parseInt(point.additionalProperties?.find(p => p.key === 'NbEmptyDocks')?.value || '0'),
            totalDocks: parseInt(point.additionalProperties?.find(p => p.key === 'NbDocks')?.value || '0')
          }));
        } else {
          console.log('❌ Bike API FAILED:', response.status);
          return [];
        }
      } catch (error) {
        console.log('❌ Bike API ERROR:', error.message);
        return [];
      }
    },

    lineStatus: async () => {
      try {
        console.log('🔵 Testing Line API...');
        const response = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube/Status?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`);
        console.log('Line API Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Line API SUCCESS - Got data');
          return data.map(line => ({
            id: line.id,
            name: line.name,
            modeName: line.modeName,
            lineStatuses: line.lineStatuses?.map(status => ({
              statusSeverity: status.statusSeverity,
              statusSeverityDescription: status.statusSeverityDescription,
              reason: status.reason
            })) || []
          }));
        } else {
          console.log('❌ Line API FAILED:', response.status);
          return [];
        }
      } catch (error) {
        console.log('❌ Line API ERROR:', error.message);
        return [];
      }
    },

    lineGeometry: async (_, { lineId }) => {
      try {
        console.log(`🔍 Backend: Fetching geometry for line: ${lineId}`);
        
        const outboundUrl = `https://api.tfl.gov.uk/Line/${lineId}/Route/Sequence/outbound?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
        const inboundUrl = `https://api.tfl.gov.uk/Line/${lineId}/Route/Sequence/inbound?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`;
        
        console.log(`📡 Backend: Calling TfL API...`);

        const fetchWithAxios = async (url) => {
          try {
            const response = await axios.get(url, {
              timeout: 10000,
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'London-Transport-Dashboard/1.0'
              }
            });
            return response.data;
          } catch (error) {
            console.error(`❌ Axios error for ${url}:`, error.message);
            return null;
          }
        };

        const [outboundData, inboundData] = await Promise.all([
          fetchWithAxios(outboundUrl),
          fetchWithAxios(inboundUrl)
        ]);

        if (!outboundData && !inboundData) {
          throw new Error('Both outbound and inbound requests failed');
        }

        console.log(`✅ Backend: Successfully fetched ${lineId}`, {
          outboundSuccess: !!outboundData,
          inboundSuccess: !!inboundData,
          outboundLineStrings: outboundData?.lineStrings?.length || 0,
          inboundLineStrings: inboundData?.lineStrings?.length || 0
        });

        return {
          lineId: lineId,
          lineName: outboundData?.lineName || inboundData?.lineName || lineId,
          mode: outboundData?.mode || inboundData?.mode || 'tube',
          outbound: outboundData || null,
          inbound: inboundData || null
        };

      } catch (error) {
        console.error(`💥 Backend: Critical error for ${lineId}:`, error.message);
        throw new Error(`Failed to fetch line geometry: ${error.message}`);
      }
    },

    roadStatus: async () => {
      try {
        console.log('🔵 Fetching REAL road disruption data...');
        const response = await fetch(`https://api.tfl.gov.uk/Road/all/Disruption?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`);
        console.log('Road API Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Road API SUCCESS - Got ${data.length} disruptions`);
          
          return data.slice(0, 15).map(disruption => ({
            id: disruption.id || `road-${Math.random().toString(36).substr(2, 9)}`,
            displayName: disruption.location || disruption.streets?.[0]?.name || 'Unknown Road',
            statusSeverity: getSeverityLevel(disruption.severity),
            statusSeverityDescription: disruption.severity || 'Unknown Status',
            disruptionDetails: disruption.comments || disruption.currentUpdate || 'No details available',
            location: disruption.location,
            startDateTime: disruption.startDateTime,
            endDateTime: disruption.endDateTime
          }));
        } else {
          console.log('❌ Road API FAILED:', response.status);
          return getMockRoadStatus();
        }
      } catch (error) {
        console.log('❌ Road API ERROR:', error.message);
        return getMockRoadStatus();
      }
    },

    vehicleArrivals: async (_, { vehicleIds }) => {
      try {
        console.log('🔵 Fetching vehicle arrivals...');
        
        const idsToQuery = vehicleIds && vehicleIds.length > 0 
          ? vehicleIds.join(',') 
          : 'LX58CFV,LX11AZB,LX58CFE,LX61DNO,LX62AFV';
        
        const response = await fetch(
          `https://api.tfl.gov.uk/Vehicle/${idsToQuery}/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`
        );
        console.log('Vehicle API Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Vehicle API SUCCESS - Got ${data.length} arrivals`);
          
          return data.map(arrival => ({
            id: arrival.id,
            operationType: arrival.operationType,
            vehicleId: arrival.vehicleId,
            naptanId: arrival.naptanId,
            stationName: arrival.stationName,
            lineId: arrival.lineId,
            lineName: arrival.lineName,
            platformName: arrival.platformName,
            direction: arrival.direction,
            bearing: arrival.bearing,
            destinationNaptanId: arrival.destinationNaptanId,
            destinationName: arrival.destinationName,
            timestamp: arrival.timestamp,
            timeToStation: arrival.timeToStation ? Math.floor(arrival.timeToStation) : 120,
            currentLocation: arrival.currentLocation,
            towards: arrival.towards,
            expectedArrival: arrival.expectedArrival,
            timeToLive: arrival.timeToLive,
            modeName: arrival.modeName,
            timing: arrival.timing
          }));
        } else {
          console.log('❌ Vehicle API FAILED:', response.status);
          return simulatedVehicles.slice(0, 5);
        }
      } catch (error) {
        console.log('❌ Vehicle API ERROR:', error.message);
        return simulatedVehicles.slice(0, 5);
      }
    },

    vehicleTracking: async (_, { routeIds }) => {
      try {
        console.log('🚌 Fetching vehicle positions...');
        
        const allVehicles = [];
        const realVehicleIds = new Set();
        
        // Try to get real bus arrivals first
        try {
          const routesToTry = routeIds && routeIds.length > 0 
            ? routeIds 
            : ['1', '12', '18', '24', '38'];
          
          for (const routeId of routesToTry) {
            const response = await fetch(
              `https://api.tfl.gov.uk/Line/${routeId}/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`
            );
            
            if (response.ok) {
              const arrivals = await response.json();
              
              arrivals.slice(0, 3).forEach((arrival, index) => {
                if (realVehicleIds.has(arrival.vehicleId)) return;
                realVehicleIds.add(arrival.vehicleId);
                
                // Generate coordinates from text location or route
                let coordinates;
                if (arrival.currentLocation) {
                  coordinates = getCoordinatesFromLocationText(
                    arrival.currentLocation,
                    arrival.lineId,
                    arrival.direction
                  );
                } else {
                  coordinates = generateRouteBasedCoordinates(arrival.lineId, arrival.direction);
                }
                
                const area = getAreaFromCoordinates(coordinates.lat, coordinates.lon);
                
                allVehicles.push({
                  id: arrival.id,
                  operationType: arrival.operationType || 1,
                  vehicleId: arrival.vehicleId,
                  naptanId: arrival.naptanId,
                  stationName: arrival.stationName,
                  lineId: arrival.lineId,
                  lineName: arrival.lineName,
                  platformName: arrival.platformName,
                  direction: arrival.direction,
                  bearing: arrival.bearing,
                  destinationNaptanId: arrival.destinationNaptanId,
                  destinationName: arrival.destinationName,
                  timestamp: arrival.timestamp,
                  timeToStation: arrival.timeToStation ? Math.floor(arrival.timeToStation) : 120,
                  currentLocation: arrival.currentLocation,
                  towards: arrival.towards,
                  expectedArrival: arrival.expectedArrival,
                  timeToLive: arrival.timeToLive,
                  modeName: arrival.modeName || 'bus',
                  timing: arrival.timing,
                  lat: coordinates.lat,
                  lon: coordinates.lon,
                  vehicleType: 'bus',
                  isRealTime: true,
                  routeArea: area,
                  heading: arrival.bearing ? parseInt(arrival.bearing) : Math.floor(Math.random() * 360),
                  speed: 0.0005 + Math.random() * 0.001,
                  lastUpdated: arrival.timestamp || new Date().toISOString(),
                  hasRealPosition: true,
                  positionSource: arrival.currentLocation ? 'text_location' : 'route_based'
                });
              });
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } catch (error) {
          console.log('⚠️ Could not fetch real vehicle data:', error.message);
        }
        
        // Add simulated vehicles if we don't have enough real ones
        if (allVehicles.length < 64) {
          const needed = 64 - allVehicles.length;
          console.log(`➕ Adding ${needed} simulated vehicles`);
          
          const simulatedToAdd = simulatedVehicles
            .filter(v => !realVehicleIds.has(v.vehicleId))
            .slice(0, needed)
            .map(vehicle => ({
              ...vehicle,
              timeToStation: Math.floor(vehicle.timeToStation || 120),
              hasRealPosition: false,
              positionSource: 'simulated'
            }));
          
          allVehicles.push(...simulatedToAdd);
        }
        
        console.log(`✅ TOTAL: ${allVehicles.length} vehicles (${allVehicles.filter(v => v.hasRealPosition).length} real)`);
        console.log(`📍 Position sources: ${allVehicles.filter(v => v.positionSource === 'text_location').length} from text, ${allVehicles.filter(v => v.positionSource === 'route_based').length} from route, ${allVehicles.filter(v => v.positionSource === 'simulated').length} simulated`);
        
        return allVehicles.slice(0, 64);
        
      } catch (error) {
        console.log('❌ Vehicle tracking ERROR:', error.message);
        return simulatedVehicles.slice(0, 64).map(v => ({
          ...v,
          timeToStation: Math.floor(v.timeToStation || 120),
          hasRealPosition: false,
          positionSource: 'simulated_fallback'
        }));
      }
    },

    busArrivals: async () => {
      try {
        console.log('🔵 Fetching bus arrivals...');
        const response = await fetch(
          `https://api.tfl.gov.uk/Line/1/Arrivals?app_id=${TFL_APP_ID}&app_key=${TFL_APP_KEY}`
        );
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Bus Arrivals SUCCESS - Got ${data.length} arrivals`);
          
          const arrivals = data.slice(0, 10).map(arrival => {
            const isRealVehicle = arrival.vehicleId && 
              (arrival.vehicleId.startsWith('LT') || 
               arrival.vehicleId.startsWith('LX') || 
               arrival.vehicleId.startsWith('WF') ||
               /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(arrival.vehicleId));
            
            return {
              id: arrival.id,
              vehicleId: arrival.vehicleId,
              lineId: arrival.lineId,
              lineName: arrival.lineName,
              stationName: arrival.stationName,
              platformName: arrival.platformName,
              direction: arrival.direction,
              destinationName: arrival.destinationName,
              timeToStation: arrival.timeToStation,
              currentLocation: arrival.currentLocation,
              towards: arrival.towards,
              expectedArrival: arrival.expectedArrival,
              modeName: arrival.modeName,
              bearing: arrival.bearing,
              hasRealPosition: isRealVehicle
            };
          });
          
          return arrivals;
        } else {
          console.log('❌ Bus Arrivals FAILED:', response.status);
          return simulatedVehicles.slice(0, 10).map(v => ({
            ...v,
            hasRealPosition: false
          }));
        }
      } catch (error) {
        console.log('❌ Bus Arrivals ERROR:', error.message);
        return simulatedVehicles.slice(0, 10).map(v => ({
          ...v,
          hasRealPosition: false
        }));
      }
    },

    accidentStats: async (_, { year = 2023 }) => {
      try {
        console.log(`🔵 Fetching accident stats for year: ${year}`);
        const mockAccidents = [
          {
            id: 1,
            lat: 51.5074,
            lon: -0.1278,
            location: 'Trafalgar Square, Westminster',
            severity: 'Serious',
            borough: 'Westminster'
          },
          {
            id: 2,
            lat: 51.5155,
            lon: -0.0723,
            location: 'Bank Junction, City of London',
            severity: 'Slight',
            borough: 'City of London'
          }
        ];
        console.log(`✅ Accident Stats - Returning ${mockAccidents.length} records`);
        return mockAccidents;
      } catch (error) {
        console.log('❌ Accident Stats ERROR:', error.message);
        return [];
      }
    },

    airQuality: async () => {
      try {
        console.log('🔵 Fetching air quality');
        const airQualityData = {
          currentForecast: [
            {
              forecastBand: 'Low',
              forecastSummary: 'Air pollution is low across London'
            }
          ]
        };
        console.log('✅ Air Quality - Returning data');
        return airQualityData;
      } catch (error) {
        console.log('❌ Air Quality ERROR:', error.message);
        return {
          currentForecast: [
            {
              forecastBand: 'Unknown',
              forecastSummary: 'Data temporarily unavailable'
            }
          ]
        };
      }
    },

    journeyPlanner: async (_, {
      from,
      to,
      via,
      date,
      time,
      timeIs = 'departing',
      journeyPreference = 'leasttime',
      mode = ['tube', 'bus', 'overground', 'dlr', 'tram', 'walking'],
      maxWalkingMinutes = 30,
      walkingSpeed = 'average',
      useRealTimeLiveArrivals = true
    }) => {
      try {
        console.log('🔵 Planning journey...', { from, to, via, date, time });
        
        const params = new URLSearchParams({
          timeIs,
          journeyPreference,
          maxWalkingMinutes: maxWalkingMinutes.toString(),
          walkingSpeed,
          useRealTimeLiveArrivals: useRealTimeLiveArrivals.toString(),
          app_id: TFL_APP_ID,
          app_key: TFL_APP_KEY
        });

        if (via) params.append('via', via);
        if (date) params.append('date', date);
        if (time) params.append('time', time);
        if (mode && mode.length > 0) params.append('mode', mode.join(','));

        const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?${params.toString()}`;
        
        console.log('Journey API URL:', url);
        
        // Create an AbortController with a 15 second timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        console.log('Journey API Status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Journey API SUCCESS - Got ${data.journeys?.length || 0} journey options`);
          return {
            ...data,
            disambiguationRequired: false,
            fromLocationDisambiguation: { disambiguationOptions: [] },
            toLocationDisambiguation: { disambiguationOptions: [] }
          };
        } else if (response.status === 300) {
          const disambiguationData = await response.json();
          console.log('🔄 Journey API DISAMBIGUATION - Multiple matches found');
          return {
            journeys: [],
            disambiguationRequired: true,
            fromLocationDisambiguation: { 
              disambiguationOptions: disambiguationData.fromLocationDisambiguation?.disambiguationOptions || [] 
            },
            toLocationDisambiguation: { 
              disambiguationOptions: disambiguationData.toLocationDisambiguation?.disambiguationOptions || [] 
            }
          };
        } else {
          const errorText = await response.text();
          console.log('❌ Journey API FAILED:', response.status, errorText);
          throw new Error(`Journey planning failed: ${response.status}`);
        }
      } catch (error) {
        console.log('❌ Journey API ERROR:', error.message);
        throw new Error(`Journey planning error: ${error.message}`);
      }
    },
    validateLocation: async (_, { name }) => {
      try {
        console.log('🔎 Validating location (extended):', name);
        const result = await validateLocationService(name);
        // Ensure returned shape matches GraphQL type
        return {
          input: name,
          found: !!result?.found,
          lat: result?.lat,
          lon: result?.lon,
          inLondon: !!result?.inLondon
        };
      } catch (error) {
        console.warn('⚠️ validateLocation error:', error.message);
        return { input: name, found: false };
      }
    },

    networkStatus: async () => {
      try {
        console.log('🔵 Fetching network status');
        const mockNetwork = [
          {
            id: 'tube',
            name: 'London Underground',
            modeName: 'tube',
            lineStatuses: [
              {
                statusSeverity: 10,
                statusSeverityDescription: 'Good Service',
                reason: ''
              }
            ]
          }
        ];
        console.log(`✅ Network Status - Returning ${mockNetwork.length} records`);
        return mockNetwork;
      } catch (error) {
        console.log('❌ Network Status ERROR:', error.message);
        return [];
      }
    }
  }
};

// ========== HELPER FUNCTIONS ==========

function getCoordinatesFromLocationText(locationText, lineId, direction) {
  const locationMap = {
    'Oxford Circus': { lat: 51.5155, lon: -0.1412 },
    'Trafalgar Square': { lat: 51.5081, lon: -0.1246 },
    'Piccadilly Circus': { lat: 51.5101, lon: -0.1340 },
    'Leicester Square': { lat: 51.5113, lon: -0.1281 },
    'Charing Cross': { lat: 51.5081, lon: -0.1246 },
    'Bank': { lat: 51.5134, lon: -0.0890 },
    'Liverpool Street': { lat: 51.5175, lon: -0.0820 },
    'Victoria Station': { lat: 51.4950, lon: -0.1445 },
    'Waterloo': { lat: 51.5030, lon: -0.1050 },
    'London Bridge': { lat: 51.5050, lon: -0.0860 },
    'Paddington': { lat: 51.5154, lon: -0.1755 },
    'Kings Cross': { lat: 51.5308, lon: -0.1238 },
    'St Pancras': { lat: 51.5308, lon: -0.1238 },
    'Euston': { lat: 51.5280, lon: -0.1330 },
    'Marble Arch': { lat: 51.5135, lon: -0.1585 },
    'Hyde Park Corner': { lat: 51.5028, lon: -0.1528 },
    'Knightsbridge': { lat: 51.5020, lon: -0.1600 },
    'South Kensington': { lat: 51.4851, lon: -0.1405 },
    'Gloucester Road': { lat: 51.4945, lon: -0.1829 },
    'Earls Court': { lat: 51.4920, lon: -0.1970 },
    'Approaching': { lat: 51.5074, lon: -0.1278 },
    'At': { lat: 51.5074, lon: -0.1278 },
    'Near': { lat: 51.5074, lon: -0.1278 },
    'Just left': { lat: 51.5074, lon: -0.1278 },
  };

  for (const [key, coords] of Object.entries(locationMap)) {
    if (locationText && locationText.toLowerCase().includes(key.toLowerCase())) {
      return {
        lat: coords.lat + (Math.random() * 0.005 - 0.0025),
        lon: coords.lon + (Math.random() * 0.005 - 0.0025)
      };
    }
  }

  return generateRouteBasedCoordinates(lineId, direction);
}
function generateRouteBasedCoordinates(lineId, direction) {
  const routePositions = {
    '1': {
      inbound: { lat: 51.5007, lon: -0.0760 },
      outbound: { lat: 51.5074, lon: -0.1278 }
    },
    '12': {
      inbound: { lat: 51.5074, lon: -0.1278 },
      outbound: { lat: 51.4926, lon: -0.1946 }
    },
    '18': {
      inbound: { lat: 51.5250, lon: -0.1200 },
      outbound: { lat: 51.4643, lon: -0.1695 }
    },
    '24': {
      inbound: { lat: 51.5074, lon: -0.1278 },
      outbound: { lat: 51.5452, lon: -0.1428 }
    },
    '38': {
      inbound: { lat: 51.5207, lon: -0.0744 },
      outbound: { lat: 51.4926, lon: -0.1946 }
    }
  };

  const routeData = routePositions[lineId] || routePositions['1'];
  const base = direction === 'inbound' ? routeData.inbound : routeData.outbound;
  
  const progress = Math.random();
  const latOffset = (Math.random() * 0.02 - 0.01) * progress;
  const lonOffset = (Math.random() * 0.02 - 0.01) * progress;
  
  return {
    lat: base.lat + latOffset,
    lon: base.lon + lonOffset
  };
}

function getDefaultRouteStops(routeId) {
  const hardcodedStops = {
    '1': [
      { lat: 51.5081, lon: -0.1246, name: 'Trafalgar Square' },
      { lat: 51.5135, lon: -0.1585, name: 'Marble Arch' },
      { lat: 51.5155, lon: -0.1412, name: 'Oxford Circus' },
      { lat: 51.5074, lon: -0.1278, name: 'Westminster' },
      { lat: 51.5030, lon: -0.1050, name: 'Waterloo' },
      { lat: 51.5007, lon: -0.0760, name: 'Canada Water' }
    ],
    '12': [
      { lat: 51.4926, lon: -0.1946, name: 'Shepherds Bush' },
      { lat: 51.4995, lon: -0.1805, name: 'Notting Hill Gate' },
      { lat: 51.5135, lon: -0.1585, name: 'Marble Arch' },
      { lat: 51.5155, lon: -0.1412, name: 'Oxford Circus' },
      { lat: 51.5074, lon: -0.1278, name: 'Trafalgar Square' },
      { lat: 51.4950, lon: -0.1445, name: 'Victoria' }
    ],
    '18': [
      { lat: 51.4643, lon: -0.1695, name: 'Clapham Junction' },
      { lat: 51.4725, lon: -0.1535, name: 'Chelsea' },
      { lat: 51.4851, lon: -0.1405, name: 'South Kensington' },
      { lat: 51.4950, lon: -0.1445, name: 'Victoria' },
      { lat: 51.5074, lon: -0.1278, name: 'Trafalgar Square' },
      { lat: 51.5165, lon: -0.1310, name: 'Tottenham Court Road' }
    ],
    '24': [
      { lat: 51.5452, lon: -0.1428, name: 'Camden Town' },
      { lat: 51.5322, lon: -0.1575, name: 'Regents Park' },
      { lat: 51.5155, lon: -0.1412, name: 'Oxford Circus' },
      { lat: 51.5074, lon: -0.1278, name: 'Trafalgar Square' },
      { lat: 51.5007, lon: -0.0760, name: 'Pimlico' }
    ],
    '38': [
      { lat: 51.4950, lon: -0.1445, name: 'Victoria' },
      { lat: 51.5074, lon: -0.1278, name: 'Trafalgar Square' },
      { lat: 51.5155, lon: -0.1412, name: 'Oxford Circus' },
      { lat: 51.5165, lon: -0.1310, name: 'Tottenham Court Road' },
      { lat: 51.5250, lon: -0.1200, name: 'Kings Cross' }
    ]
  };
  
  return hardcodedStops[routeId] || [
    { lat: 51.5074, lon: -0.1278, name: 'Central London' },
    { lat: 51.5400, lon: -0.1430, name: 'North London' },
    { lat: 51.4643, lon: -0.1695, name: 'South London' },
    { lat: 51.5207, lon: -0.0744, name: 'East London' },
    { lat: 51.4926, lon: -0.1946, name: 'West London' }
  ];
}

function getVehiclePositionOnRoute(vehicleId, routeId, direction, routeStops, totalIndex) {
  let hash = 0;
  for (let i = 0; i < vehicleId.length; i++) {
    hash = vehicleId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  if (routeStops && routeStops.length > 0) {
    const uniqueIndex = (hash + totalIndex) % routeStops.length;
    const stop = routeStops[uniqueIndex];
    
    const latOffset = ((hash * 7) % 200 - 100) * 0.0001;
    const lonOffset = ((hash * 13) % 200 - 100) * 0.0001;
    
    return {
      lat: stop.lat + latOffset,
      lon: stop.lon + lonOffset,
      area: getAreaFromCoordinates(stop.lat, stop.lon)
    };
  }
  
  return getUniqueVehiclePosition(vehicleId, routeId, totalIndex);
}

function getUniqueVehiclePosition(vehicleId, routeId, totalIndex) {
  let hash = 0;
  for (let i = 0; i < vehicleId.length; i++) {
    hash = vehicleId.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  const basePositions = {
    '1': { lat: 51.5074, lon: -0.1278 },
    '12': { lat: 51.4926, lon: -0.1946 },
    '18': { lat: 51.4643, lon: -0.1695 },
    '24': { lat: 51.5452, lon: -0.1428 },
    '38': { lat: 51.5250, lon: -0.1200 },
    'default': { lat: 51.5074 + ((hash % 100) * 0.005 - 0.25), lon: -0.1278 + ((hash % 100) * 0.005 - 0.25) }
  };
  
  const base = basePositions[routeId] || basePositions.default;
  
  const latOffset = ((hash * totalIndex) % 1000 - 500) * 0.0002;
  const lonOffset = ((hash * (totalIndex + 1)) % 1000 - 500) * 0.0002;
  
  const lat = base.lat + latOffset;
  const lon = base.lon + lonOffset;
  
  return {
    lat: Math.max(51.3, Math.min(51.7, lat)),
    lon: Math.max(-0.5, Math.min(0.2, lon)),
    area: getAreaFromCoordinates(lat, lon)
  };
}

function getRealisticVehicleDataAlongRoutes() {
  const vehicles = [];
  const routeIds = ['1', '12', '18', '24', '38', '55', '73', '94', '137', '148'];
  
  const routeStopsCache = {};
  
  for (const routeId of routeIds) {
    routeStopsCache[routeId] = getDefaultRouteStops(routeId);
  }
  
  for (let i = 0; i < 64; i++) {
    const routeIndex = i % routeIds.length;
    const routeId = routeIds[routeIndex];
    const routeStops = routeStopsCache[routeId];
    
    if (routeStops.length > 1) {
      const progress = (i % 20) / 20;
      const stopCount = routeStops.length;
      const segment = Math.floor(progress * (stopCount - 1));
      const segmentProgress = (progress * (stopCount - 1)) - segment;
      
      const stop1 = routeStops[segment];
      const stop2 = routeStops[Math.min(segment + 1, stopCount - 1)];
      
      const lat = stop1.lat + (stop2.lat - stop1.lat) * segmentProgress;
      const lon = stop1.lon + (stop2.lon - stop1.lon) * segmentProgress;
      
      const latOffset = ((i * 13) % 100 - 50) * 0.0001;
      const lonOffset = ((i * 17) % 100 - 50) * 0.0001;
      
      vehicles.push(createVehicleObject(i, routeId, lat + latOffset, lon + lonOffset));
    } else {
      const position = getUniqueVehiclePosition(`vehicle-${i}`, routeId, i);
      vehicles.push(createVehicleObject(i, routeId, position.lat, position.lon));
    }
  }
  
  console.log(`✅ Created ${vehicles.length} simulated vehicles at unique positions`);
  return vehicles;
}

function createVehicleObject(index, routeId, lat, lon) {
  const area = getAreaFromCoordinates(lat, lon);
  const currentTime = new Date();
  
  return {
    id: `vehicle-${index + 1}`,
    operationType: 1,
    vehicleId: `SIM${String(index + 1000).padStart(4, '0')}`,
    naptanId: `940GZZ${String(index).padStart(3, '0')}`,
    stationName: `${area} Bus Stop`,
    lineId: routeId,
    lineName: `Bus ${routeId}`,
    platformName: String.fromCharCode(65 + (index % 8)),
    direction: index % 2 === 0 ? 'inbound' : 'outbound',
    bearing: String((index * 45) % 360),
    destinationNaptanId: `940GZZ${String((index + 10) % 1000).padStart(3, '0')}`,
    destinationName: index % 2 === 0 ? 'Canada Water' : 'Victoria Station',
    timestamp: currentTime.toISOString(),
    timeToStation: 60 + Math.floor((index % 7) * 30),
    currentLocation: `Route ${routeId}, ${area}`,
    towards: index % 2 === 0 ? 'East' : 'West',
    expectedArrival: new Date(currentTime.getTime() + (120000 + index * 30000)).toISOString(),
    timeToLive: new Date(currentTime.getTime() + 300000).toISOString(),
    modeName: 'bus',
    timing: null,
    lat: lat,
    lon: lon,
    vehicleType: 'bus',
    isRealTime: false,
    routeArea: area,
    heading: Math.floor((index * 45) % 360),
    speed: 0.0005 + (index % 10) * 0.0001,
    lastUpdated: new Date(currentTime.getTime() - index * 10000).toISOString(),
    hasRealPosition: false,
    positionSource: 'simulated'
  };
}

function getAreaFromCoordinates(lat, lon) {
  const areas = [
    { name: 'Westminster', lat: 51.5074, lon: -0.1278 },
    { name: 'City of London', lat: 51.5155, lon: -0.0723 },
    { name: 'Camden', lat: 51.5400, lon: -0.1430 },
    { name: 'Islington', lat: 51.5360, lon: -0.1030 },
    { name: 'Hackney', lat: 51.5435, lon: -0.0255 },
    { name: 'Southwark', lat: 51.5030, lon: -0.1050 },
    { name: 'Lambeth', lat: 51.4950, lon: -0.1150 },
    { name: 'Kensington', lat: 51.5025, lon: -0.1975 },
    { name: 'Hammersmith', lat: 51.4925, lon: -0.2225 },
    { name: 'Wandsworth', lat: 51.4575, lon: -0.1925 },
    { name: 'Canary Wharf', lat: 51.5050, lon: -0.0235 },
    { name: 'Stratford', lat: 51.5415, lon: -0.0025 }
  ];
  
  let closestArea = 'Central London';
  let minDistance = Infinity;
  
  for (const area of areas) {
    const distance = Math.sqrt(
      Math.pow(lat - area.lat, 2) + Math.pow(lon - area.lon, 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestArea = area.name;
    }
  }
  
  return closestArea;
}

function getVehicleType(modeName) {
  const typeMap = {
    'bus': 'bus',
    'tube': 'train',
    'overground': 'train',
    'dlr': 'train',
    'tram': 'tram',
    'river-bus': 'boat'
  };
  return typeMap[modeName?.toLowerCase()] || 'bus';
}

function getSeverityLevel(severity) {
  const severityMap = {
    'Closed': 1,
    'Blocked': 2,
    'Severe': 3,
    'Serious': 4,
    'Very Heavy': 5,
    'Heavy': 6,
    'Moderate': 7,
    'Minor': 8,
    'Good': 10
  };
  return severityMap[severity] || 5;
}

function getMockRoadStatus() {
  return [
    {
      id: 'A1',
      displayName: 'A1',
      statusSeverity: 10,
      statusSeverityDescription: 'Good Service',
      disruptionDetails: 'No disruptions reported',
      location: 'A1 Road',
      startDateTime: null,
      endDateTime: null
    }
  ];
}

async function startServer() {
  const app = express();
  
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    formatError: (error) => {
      console.log('🔴 GraphQL Error:', {
        message: error.message,
        path: error.path,
        locations: error.locations
      });
      
      if (error.message.includes('Int cannot represent non-integer value')) {
        console.log('⚠️ FLOAT/INT MISMATCH DETECTED - Check timeToStation, heading fields');
      }
      
      return {
        message: error.message,
        locations: error.locations,
        path: error.path
      };
    }
  });
  
  await server.start();
  
  // Initialize simulated vehicles
  initializeSimulatedVehicles();
  startVehicleSimulation();
  
  // CORS configuration for all requests
  const corsOptions = {
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.use(cors(corsOptions));
  app.use(express.json());

  app.use('/graphql', 
    expressMiddleware(server, {
      context: async ({ req }) => ({ req }),
    })
  );

  // Lightweight test endpoint returning a small set of simulated vehicles
  // This avoids heavy TfL StopPoint lookups while debugging locally.
  app.get('/api/vehicles-test', (req, res) => {
    try {
      const count = Math.min(50, parseInt(req.query.count || '10', 10));
      const list = (simulatedVehicles || []).slice(0, count).map(v => ({
        vehicleId: v.vehicleId,
        lineName: v.lineName,
        lineId: v.lineId,
        stationName: v.stationName,
        destinationName: v.destinationName,
        lat: v.lat,
        lon: v.lon,
        hasRealPosition: false,
        positionSource: 'simulated',
        nextStopCoords: generateRouteBasedCoordinates(v.lineId, v.direction),
        destinationCoords: null
      }));
      return res.json(list);
    } catch (err) {
      console.error('❌ /api/vehicles-test error', err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/journey/coords', async (req, res) => {
    const stopName = req.query.stopName;
    if (!stopName) return res.status(400).json({ error: 'missing stopName' });

    try {
        const appId = process.env.TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.TFL_APP_ID)}&` : '';
        const appKey = process.env.TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.TFL_APP_KEY)}` : '';
        const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';

        const url = `https://api.tfl.gov.uk/Journey/JourneyResults/${encodeURIComponent(stopName)}/to/${encodeURIComponent(stopName)}${authQuery}`;
        const r = await fetch(url);
        if (!r.ok) return res.status(r.status).json({ error: 'TfL returned ' + r.status });
        const data = await r.json();

        // Attempt to extract coordinates from JourneyResults payload:
        let lat, lon, foundBy = null;
        const journeys = data.journeys || [];
        if (journeys.length) {
            // Try departurePoint of first leg
            const firstLeg = journeys[0].legs && journeys[0].legs[0];
            if (firstLeg && firstLeg.departurePoint && (firstLeg.departurePoint.lat || firstLeg.departurePoint.lon)) {
                lat = firstLeg.departurePoint.lat;
                lon = firstLeg.departurePoint.lon;
                foundBy = 'leg.departurePoint';
            }
            // If not found, search stopPoints in path
            if ((lat === undefined || lon === undefined) && firstLeg && firstLeg.path && Array.isArray(firstLeg.path.stopPoints)) {
                const match = firstLeg.path.stopPoints.find(sp => sp && sp.name && sp.name.toLowerCase().includes(stopName.toLowerCase()));
                if (match && (match.lat || match.lon)) {
                    lat = match.lat;
                    lon = match.lon;
                    foundBy = 'path.stopPoints';
                }
            }
            // try any stopPoints across all legs
            if ((lat === undefined || lon === undefined)) {
                for (const j of journeys) {
                    for (const leg of j.legs || []) {
                        const stop = (leg.path && leg.path.stopPoints || []).find(sp => sp && sp.name && sp.name.toLowerCase().includes(stopName.toLowerCase()));
                        if (stop && (stop.lat || stop.lon)) {
                            lat = stop.lat; lon = stop.lon; foundBy = 'any.stopPoints'; break;
                        }
                    }
                    if (lat !== undefined && lon !== undefined) break;
                }
            }
        }

        if (lat === undefined || lon === undefined) {
            return res.status(404).json({ error: 'coordinates not found in JourneyResults payload', raw: data });
        }

        return res.json({ lat, lon, foundBy });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'internal' });
    }
});

  // Tube Lines endpoint
  app.get('/api/tube-lines', async (req, res) => {
    try {
      const appId = process.env.TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.TFL_APP_ID)}&` : '';
      const appKey = process.env.TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.TFL_APP_KEY)}` : '';
      const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
      
      const response = await fetch(`https://api.tfl.gov.uk/Line/Mode/tube${authQuery}`);
      if (!response.ok) throw new Error('TfL API error');
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch tube lines' });
    }
  });

  // Bike Points endpoint
  app.get('/api/bike-points', async (req, res) => {
    try {
      const appId = process.env.TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.TFL_APP_ID)}&` : '';
      const appKey = process.env.TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.TFL_APP_KEY)}` : '';
      const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
      
      const response = await fetch(`https://api.tfl.gov.uk/BikePoint${authQuery}`);
      if (!response.ok) throw new Error('TfL API error');
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch bike points' });
    }
  });

  // Accidents endpoint (using disruptions/road-accidents)
  app.get('/api/accidents', async (req, res) => {
    try {
      const appId = process.env.TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.TFL_APP_ID)}&` : '';
      const appKey = process.env.TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.TFL_APP_KEY)}` : '';
      const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
      
      const response = await fetch(`https://api.tfl.gov.uk/Disruptions/Accidents${authQuery}`);
      if (!response.ok) throw new Error('TfL API error');
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch accidents' });
    }
  });

  // Air Quality endpoint
  app.get('/api/air-quality', async (req, res) => {
    try {
      const response = await fetch('https://api.tfl.gov.uk/AirQuality');
      if (!response.ok) throw new Error('TfL API error');
      const data = await response.json();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch air quality' });
    }
  });

  // Network endpoint
  app.get('/api/network', async (req, res) => {
    try {
      const appId = process.env.TFL_APP_ID ? `app_id=${encodeURIComponent(process.env.TFL_APP_ID)}&` : '';
      const appKey = process.env.TFL_APP_KEY ? `app_key=${encodeURIComponent(process.env.TFL_APP_KEY)}` : '';
      const authQuery = (appId || appKey) ? `?${appId}${appKey}`.replace(/\?$/, '') : '';
      
      const response = await fetch(`https://api.tfl.gov.uk/Line${authQuery}`);
      if (!response.ok) throw new Error('TfL API error');
      const data = await response.json();
      
      res.json({
        totalLines: data.length,
        totalStations: 270, // approximate for London
        status: 'Operational',
        lines: data
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch network data' });
    }
  });

  // Live Vehicles endpoint - Now using REAL TfL data
  app.get('/api/vehicles', async (req, res) => {
    try {
      console.log('📡 /api/vehicles endpoint called - fetching from TfL...');
      
      // Get real live vehicle data from TfL
      const liveVehicles = await getLiveVehicles();
      
      console.log(`✅ Fetched ${liveVehicles.length} live vehicles from TfL`);

      if (liveVehicles.length === 0) {
        console.log('⚠️ No live vehicles from TfL — falling back to simulated vehicles');
        const fallback = simulatedVehicles.slice(0, 64).map(v => ({
          vehicleId: v.vehicleId,
          lineName: v.lineName,
          lineId: v.lineId,
          stationName: v.stationName,
          destinationName: v.destinationName,
          direction: v.direction,
          bearing: v.bearing,
          lat: v.lat,
          lon: v.lon,
          heading: v.heading,
          timeToStation: Math.floor(v.timeToStation || 120),
          currentLocation: v.currentLocation,
          towards: v.towards,
          modeName: v.modeName || 'bus',
          lastUpdated: v.lastUpdated,
          hasRealPosition: false,
          positionSource: 'simulated',
          nextStopCoords: generateRouteBasedCoordinates(v.lineId, v.direction),
          destinationCoords: null
        }));

        return res.json(fallback);
      }

      // Format response using live data
      const vehicleData = liveVehicles.map(v => ({
        vehicleId: v.vehicleId,
        lineName: v.lineName,
        lineId: v.lineId,
        stationName: v.stationName,
        destinationName: v.destinationName,
        direction: v.direction,
        bearing: v.bearing,
        lat: v.lat,
        lon: v.lon,
        heading: v.heading,
        timeToStation: v.timeToStation,
        currentLocation: v.currentLocation,
        towards: v.towards,
        modeName: v.modeName,
        lastUpdated: v.lastUpdated,
        hasRealPosition: v.hasRealPosition,
        positionSource: v.positionSource,
        nextStopCoords: v.nextStopCoords, // For frontend animation
        destinationCoords: v.destinationCoords || null
      }));

      res.json(vehicleData);
    } catch (err) {
      console.error('❌ /api/vehicles error:', err);
      res.status(500).json({ error: 'Failed to fetch live vehicles', details: err.message });
    }
  });

  const DEFAULT_PORT = parseInt(process.env.PORT || '4001', 10);
  let listenPort = DEFAULT_PORT;

  const startListening = (port) => {
    const srv = app.listen(port, () => {
      console.log('================================');
      console.log('🚀 BACKEND SERVER STARTED');
      console.log(`📍 http://localhost:${port}/graphql`);
      console.log('� Using REAL TfL Live Data API');
      console.log('🚌 Tracking London Transport vehicles');
      console.log('✅ Selected vehicle position updates available');
      console.log('================================');

      // Start cache cleanup for stop points
      startCacheCleanup();
    });

    srv.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${port} in use, trying ${port + 1}...`);
        listenPort = port + 1;
        setTimeout(() => startListening(listenPort), 200);
        return;
      }
      console.error('Server error:', err);
      process.exit(1);
    });
  };

  startListening(listenPort);
}

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

startServer().catch(console.error);