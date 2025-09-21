
import { locationAPI } from '../services/api.js';

class GeoTracker {
  constructor() {
    this.watchId = null;
    this.intervalId = null;
    this.updateInterval = 5000; 
    this.isTracking = false;
    this.tripData = null;
    this.onLocationUpdate = null;
    this.onError = null;
    this.lastUpdateTime = 0;
    this.isGettingPosition = false; 
    this.lastGpsDataTime = 0; 
    this.bestAccuracy = null; 
    this.accuracyThreshold = 100; 
    this.maxWaitTime = 10000; 
    this.fallbackThreshold = 30000; 
    this.emergencyThreshold = 60000; 
    this.accuracyWaitStart = 0; 
  }

  
  startTracking(tripData, onLocationUpdate = null, onError = null) {
    if (!navigator.geolocation) {
      const error = new Error('Geolocation is not supported by this browser');
      if (onError) onError(error);
      return false;
    }

    
    const isSecure = (typeof window !== 'undefined') && (window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost');
    if (!isSecure) {
      const msg = 'Browser blocked GPS: geolocation requires HTTPS (or localhost). Use an HTTPS URL (e.g., ngrok HTTPS) to enable location on phones.';
      console.error(msg);
      if (onError) onError(new Error(msg));
      return false;
    }

    this.tripData = tripData;
    this.isTracking = true;
    this.onLocationUpdate = onLocationUpdate;
    this.onError = onError;
    this.bestAccuracy = null;
    this.accuracyWaitStart = Date.now();


    
    const options = {
      enableHighAccuracy: true, 
      timeout: 30000, 
      maximumAge: 60000 
    };

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.handlePosition(position),
      (error) => this.handleError(error),
      options
    );

    
    this.intervalId = setInterval(() => {
      if (this.isTracking) {
        const timeSinceLastGpsData = Date.now() - this.lastGpsDataTime;
        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;

        
        
        
        
        if (timeSinceLastGpsData > 10000 && timeSinceLastUpdate >= this.updateInterval && !this.isGettingPosition) {
          this.getCurrentPosition();
        }
      }
    }, 5000); 

    return true;
  }

  
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isTracking = false;
    this.isGettingPosition = false;
    this.tripData = null;
    this.lastUpdateTime = 0;
    this.lastGpsDataTime = 0;
    this.bestAccuracy = null;
  }

  
  getCurrentPosition() {
    if (this.isGettingPosition) {
      console.log('⚠️ GPS request already in progress, skipping');
      return;
    }

    const options = {
      enableHighAccuracy: true, 
      timeout: 30000, 
      maximumAge: 60000 
    };

    const startTime = Date.now();
    this.isGettingPosition = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.isGettingPosition = false;
        this.handlePosition(position);
      },
      (error) => {
        this.isGettingPosition = false;
        this.handleError(error);
      },
      options
    );
  }

  
  async handlePosition(position) {
    const currentTime = Date.now();
    this.lastGpsDataTime = currentTime; 

    const timeSinceLastUpdate = currentTime - this.lastUpdateTime;

    
    const hasGoodAccuracy = position.coords.accuracy <= this.accuracyThreshold;

    
    if (this.bestAccuracy === null || position.coords.accuracy < this.bestAccuracy) {
      this.bestAccuracy = position.coords.accuracy;
    }

    
    const timeWaiting = currentTime - this.accuracyWaitStart;
    const waitedTooLong = timeWaiting > this.maxWaitTime;
    const fallbackMode = timeWaiting > this.fallbackThreshold;
    const emergencyMode = timeWaiting > this.emergencyThreshold;

    
    let shouldAccept = false;
    let reason = '';

    if (hasGoodAccuracy) {
      shouldAccept = true;
      reason = 'good accuracy';
    } else if (emergencyMode) {
      
      if (position.coords.accuracy < 100000) {
        shouldAccept = true;
        reason = 'emergency mode (any accuracy under 100km)';
      }
    } else if (fallbackMode) {
      
      if (position.coords.accuracy < 50000) {
        shouldAccept = true;
        reason = 'fallback mode (accuracy under 50km)';
      }
    } else if (waitedTooLong) {
      
      if (position.coords.accuracy < 10000) {
        shouldAccept = true;
        reason = 'waited too long (accuracy under 10km)';
      }
    }

    
    if (this.lastUpdateTime > 0 && timeSinceLastUpdate < this.updateInterval && !shouldAccept) {
      return;
    }

    if (!shouldAccept) {
      return;
    }

    const { latitude, longitude } = position.coords;
    const timestamp = new Date().toISOString();
    const timeString = new Date().toLocaleTimeString();

    
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      console.error(`❌ Invalid coordinates: lat=${latitude}, lng=${longitude}`);
      return;
    }

    


    try {
      
      const result = await locationAPI.saveLocation({
        tripId: this.tripData.trip_id,
        latitude: latitude,
        longitude: longitude,
        timestamp: timestamp,
        accuracy: position.coords.accuracy
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to save location');
      }

      this.lastUpdateTime = currentTime;
      this.accuracyWaitStart = currentTime; 

      
      if (this.onLocationUpdate) {
        this.onLocationUpdate({
          latitude,
          longitude,
          timestamp,
          accuracy: position.coords.accuracy,
          data: result.data
        });
      }

    } catch (error) {
      console.error('Error saving location via API:', error);
      if (this.onError) this.onError(error);
    }
  }

  
  handleError(error) {
    let errorMessage = 'Unknown location error';

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user. Please enable location permissions.';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable. Please check your GPS settings.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timeout. Please try again or check your GPS signal.';
        break;
    }

    
    if (error && error.message && /Only secure origins are allowed|secure context|https/i.test(error.message)) {
      errorMessage = 'GPS blocked: this page is not HTTPS. Open the HTTPS URL (or use localhost) to enable geolocation.';
    }

    
    if (error.code === error.TIMEOUT && this.isTracking) {
      this.tryFallbackGPS();
    } else {
      if (this.onError) this.onError(new Error(errorMessage));
    }
  }

  
  tryFallbackGPS() {
    const fallbackOptions = {
      enableHighAccuracy: false, 
      timeout: 10000, 
      maximumAge: 300000 
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.handlePosition(position);
      },
      (error) => {
        if (this.onError) this.onError(new Error('GPS unavailable. Please check your location settings and try again.'));
      },
      fallbackOptions
    );
  }

  
  getTrackingStatus() {
    return {
      isTracking: this.isTracking,
      intervalId: this.intervalId,
      tripData: this.tripData,
      lastUpdateTime: this.lastUpdateTime,
      bestAccuracy: this.bestAccuracy
    };
  }

  
  updateTripData(newTripData) {
    if (this.isTracking) {
      this.tripData = { ...this.tripData, ...newTripData };
    }
  }
}


export const geoTracker = new GeoTracker();


export { GeoTracker };