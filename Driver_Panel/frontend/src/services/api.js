



export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';


const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};


export const authAPI = {
  
  login: async (driverId, busNumber) => {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ driverId, busNumber }),
    });
  },

  
  logout: async (driverId, busNumber) => {
    return apiRequest('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ driverId, busNumber }),
    });
  },

  
  getDriver: async (driverId) => {
    return apiRequest(`/auth/driver/${driverId}`);
  },
};


export const tripAPI = {
  
  getActiveTrip: async (driverId) => {
    return apiRequest(`/trips/active/${driverId}`);
  },

  
  startTrip: async (driverId, busNumber) => {
    return apiRequest('/trips/start', {
      method: 'POST',
      body: JSON.stringify({ driverId, busNumber }),
    });
  },

  
  endTrip: async (tripId) => {
    return apiRequest('/trips/end', {
      method: 'POST',
      body: JSON.stringify({ tripId }),
    });
  },

  
  getTripById: async (tripId) => {
    return apiRequest(`/trips/${tripId}`);
  },
};


export const locationAPI = {
  
  saveLocation: async (locationData) => {
    return apiRequest('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    });
  },

  
  getLocationHistory: async (tripId, limit = 50) => {
    return apiRequest(`/locations/trip/${tripId}?limit=${limit}`);
  },

  
  getLatestLocation: async (tripId) => {
    return apiRequest(`/locations/latest/${tripId}`);
  },

  
  getActiveLocations: async () => {
    return apiRequest('/locations/active');
  },
};


export const healthAPI = {
  
  check: async () => {
    try {
      const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { success: false, error: 'Backend not reachable' };
    }
  },
};