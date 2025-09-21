
import React, { useState, useEffect } from 'react';
import { useDriver } from '../context/DriverContext';
import { geoTracker } from '../utils/geo';
import { tripAPI, API_BASE_URL } from '../services/api';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Activity, Wifi, WifiOff, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const Trip = () => {
  const navigate = useNavigate();
  const { driver, logout } = useDriver();
  const [tripId, setTripId] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Not tracking');
  const [error, setError] = useState(null);
  const [lastLocation, setLastLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [nextUpdateIn, setNextUpdateIn] = useState(0);
  const [socket, setSocket] = useState(null);
  const [gpsMode, setGpsMode] = useState('waiting');
  const [loadingAction, setLoadingAction] = useState(null); 
  const [lastAction, setLastAction] = useState('idle');

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const trackerStatus = geoTracker.getTrackingStatus();
      if (trackerStatus.isTracking && trackerStatus.lastUpdateTime) {
        const timeSinceLastUpdate = Date.now() - trackerStatus.lastUpdateTime;
        const timeToNextUpdate = Math.max(0, 5000 - timeSinceLastUpdate);
        setNextUpdateIn(Math.ceil(timeToNextUpdate / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  
  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      
    });

    newSocket.on('disconnect', () => {
      
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => { checkActiveTrip(); }, [driver.driverId]);

  useEffect(() => () => { if (isActive) geoTracker.stopTracking(); }, [isActive]);

  
  useEffect(() => {
    if (!isActive || !tripId) return;
    const status = geoTracker.getTrackingStatus();
    if (!status.isTracking) {
      const started = geoTracker.startTracking(
        { trip_id: tripId, driver_id: driver.driverId, bus_number: driver.busNumber },
        handleLocationUpdate,
        handleLocationError
      );
      setLocationStatus(started ? 'GPS tracking active (resumed)' : 'Trip active - GPS blocked. Use HTTPS or localhost for GPS.');
      setLastAction(started ? 'Resumed GPS' : 'GPS blocked');
    }
  }, [isActive, tripId, driver.driverId, driver.busNumber]);

  const checkActiveTrip = async () => {
    if (!driver.driverId) return;
    try {
      const result = await tripAPI.getActiveTrip(driver.driverId);
      if (!result.success) return;
      if (result.data) {
        setTripId(result.data.tripId);
        setIsActive(true);
        setLocationStatus('Trip active - preparing GPS…');
      }
    } catch (err) {
      setError('Failed to check for active trips');
    }
  };

  const startTrip = async () => {
    if (!driver.driverId || !driver.busNumber) {
      setError('Driver ID and Bus ID are required');
      return;
    }
    setError(null);
    setLoadingAction('start');
    setLastAction('Starting trip…');
    try {
      const result = await tripAPI.startTrip(driver.driverId, driver.busNumber);
      if (!result.success) throw new Error(result.error || 'Failed to start trip');
      const newTripId = result.data.tripId;
      setTripId(newTripId);
      setIsActive(true);
      const trackingStarted = geoTracker.startTracking(
        { trip_id: newTripId, driver_id: driver.driverId, bus_number: driver.busNumber },
        handleLocationUpdate,
        handleLocationError
      );
      setLocationStatus(trackingStarted ? 'GPS tracking active' : 'GPS tracking failed to start');
      setLastAction(trackingStarted ? 'Trip started + GPS OK' : 'Trip started, GPS blocked');
    } catch (err) {
      setError(`Failed to start trip: ${err.message}`);
      setLastAction(`Start failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const endTrip = async () => {
    if (!tripId) { setError('No active trip to end'); return; }
    setError(null);
    setLoadingAction('stop');
    setLastAction('Stopping trip…');
    try {
      geoTracker.stopTracking();
      setLocationStatus('GPS tracking stopped');
      const result = await tripAPI.endTrip(tripId);
      if (!result.success) throw new Error(result.error || 'Failed to end trip');
      setTripId(null);
      setIsActive(false);
      setLastLocation(null);
      setLastAction('Trip ended');
    } catch (err) {
      setError(`Failed to end trip: ${err.message}`);
      setLastAction(`Stop failed: ${err.message}`);
    } finally {
      setLoadingAction(null);
    }
  };

  const stopTracking = () => {
    try {
      geoTracker.stopTracking();
      setLocationStatus('GPS tracking stopped');
    } catch (err) {
      setError('Failed to stop tracking');
    }
  };

  const handleLocationUpdate = (locationData) => {
    setUpdateCount((prev) => prev + 1);
    setLastLocation({
      lat: locationData.latitude,
      lng: locationData.longitude,
      timestamp: locationData.timestamp,
    });
    if (locationData.accuracy != null) setAccuracy(Math.round(locationData.accuracy));
    setLocationStatus(`GPS tracking active - Update #${updateCount + 1}`);

    
    if (locationData.accuracy < 100) {
      setGpsMode('high-accuracy');
    } else if (locationData.accuracy < 1000) {
      setGpsMode('good');
    } else if (locationData.accuracy < 10000) {
      setGpsMode('fair');
    } else if (locationData.accuracy < 50000) {
      setGpsMode('poor');
    } else {
      setGpsMode('very-poor');
    }

    
    if (socket && tripId) {
      socket.emit('location-update', {
        tripId,
        busNumber: driver.busNumber,
        routeId: driver.routeId || 'Unknown Route',
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: locationData.timestamp,
        accuracy: locationData.accuracy
      });
    }
  };

  const handleLocationError = (error) => {
    setError(`Location error: ${error.message}`);
    setLocationStatus('GPS tracking error');
  };

  if (!driver.isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center p-4">
        <Card className="bg-card">
          <CardContent>
            <div className="text-destructive font-medium">Access Denied</div>
            <div className="text-sm text-muted-foreground">Please log in to access the trip dashboard.</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="flex-1 max-w-4xl mx-auto w-full space-y-6">
        {}
        <Card className="bg-card">
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-500" />
                <div className="font-medium">{isActive ? 'Tracking Active' : 'Tracking Inactive'}</div>
              </div>
              <div className="flex items-center gap-2">
                {isActive && (
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"
                    aria-label="Live tracking indicator"
                  />
                )}
                <Badge variant="default" className="gap-1">
                  {isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isActive ? 'Live' : 'Idle'}
                </Badge>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-1 text-left">Broadcasting location every 5 seconds</div>
          </CardContent>
        </Card>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
          <Card className="bg-card">
            <CardHeader>
              <div className="font-medium">Driver Information</div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-muted-foreground">Driver ID</div>
                  <div className="font-mono font-medium">{driver.driverId}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Bus ID</div>
                  <div className="font-mono font-medium">{driver.busNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Status</div>
                  <Badge variant="default">{isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
                {tripId && (
                  <div>
                    <div className="text-sm text-muted-foreground">Trip ID</div>
                    <div className="font-mono text-sm">{tripId}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <div className="font-medium">Current Location</div>
              </div>
            </CardHeader>
            <CardContent>
              {lastLocation ? (
                <div className="space-y-3">
                  <div className="bg-muted p-2 rounded font-mono text-sm">
                    lat: {lastLocation.lat.toFixed(6)}<br />
                    lng: {lastLocation.lng.toFixed(6)}
                  </div>
                  <div className="text-sm text-muted-foreground">Last updated: {new Date(lastLocation.timestamp).toLocaleTimeString()}</div>
                  {accuracy != null && (
                    <div className="space-y-1">
                      <div className="text-sm text-muted-foreground">Accuracy: ±{accuracy}m</div>
                      <div className={`text-xs px-2 py-1 rounded ${gpsMode === 'high-accuracy' ? 'bg-green-100 text-green-800' :
                        gpsMode === 'good' ? 'bg-blue-100 text-blue-800' :
                          gpsMode === 'fair' ? 'bg-yellow-100 text-yellow-800' :
                            gpsMode === 'poor' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                        }`}>
                        {gpsMode === 'high-accuracy' ? 'High Accuracy' :
                          gpsMode === 'good' ? 'Good' :
                            gpsMode === 'fair' ? 'Fair' :
                              gpsMode === 'poor' ? 'Poor' :
                                'Very Poor'} GPS Signal
                      </div>
                    </div>
                  )}
                  {isActive && (
                    <div className="text-sm text-muted-foreground">Next update: {nextUpdateIn > 0 ? `${nextUpdateIn}s` : 'Any moment…'}</div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No location yet.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {}
        <div className="p-3 border border-border rounded-lg text-xs text-muted-foreground">
          <div>Driver: {driver.driverId || '-'} | Bus: {driver.busNumber || '-'}</div>
          <div>Trip: {tripId || '-'} | Active: {String(isActive)} | Updates: {updateCount}</div>
          <div>Action: {lastAction} | API: {API_BASE_URL} | Socket: {import.meta.env.VITE_SOCKET_URL || window.location.origin}</div>
        </div>

        {}
        <div className="flex gap-4 justify-center pb-4">
          <Button
            size="lg"
            onClick={startTrip}
            className="gradient-cta text-white"
            disabled={isActive || loadingAction === 'start'}
          >
            {loadingAction === 'start' ? 'Starting…' : 'Start Trip'}
          </Button>
          <Button
            size="lg"
            variant="destructive"
            onClick={endTrip}
            disabled={!isActive || loadingAction === 'stop'}
          >
            {loadingAction === 'stop' ? 'Stopping…' : 'Stop Trip'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Trip;