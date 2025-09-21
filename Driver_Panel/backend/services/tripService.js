
import { supabase } from '../config/database.js';


export class TripService {
  
  
  static async getActiveTrip(driverId) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('trip_id, driver_id, bus_number, start_time, status')
        .eq('driver_id', driverId)
        .eq('status', 'active')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { 
        throw error;
      }

      return {
        success: true,
        data: data ? {
          tripId: data.trip_id,
          driverId: data.driver_id,
          busNumber: data.bus_number,
          startTime: data.start_time,
          status: data.status
        } : null
      };
    } catch (error) {
      console.error('Get active trip error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to check for active trips'
      };
    }
  }

  
  static async startTrip(driverId, busNumber, startingLatitude, startingLongitude) {
    try {
      
      const activeTrip = await this.getActiveTrip(driverId);
      if (activeTrip.success && activeTrip.data) {
        return {
          success: false,
          error: 'Driver already has an active trip'
        };
      }

      const insertPayload = {
        driver_id: driverId,
        bus_number: busNumber,
        status: 'active',
        start_time: new Date().toISOString()
      };

      if (startingLatitude !== undefined && startingLongitude !== undefined) {
        insertPayload.starting_latitude = parseFloat(startingLatitude);
        insertPayload.starting_longitude = parseFloat(startingLongitude);
      }

      const { data, error } = await supabase
        .from('trips')
        .insert(insertPayload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      
      await supabase
        .from('drivers')
        .update({ status: 'on_trip', current_bus: busNumber })
        .eq('driver_id', driverId);
      await supabase
        .from('buses')
        .update({ status: 'running', current_driver: driverId })
        .eq('bus_number', busNumber);

      return {
        success: true,
        data: {
          tripId: data.trip_id,
          driverId: data.driver_id,
          busNumber: data.bus_number,
          startTime: data.start_time,
          status: data.status,
          startingLatitude: data.starting_latitude ?? null,
          startingLongitude: data.starting_longitude ?? null
        }
      };
    } catch (error) {
      console.error('Start trip error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to start trip'
      };
    }
  }

  
  static async endTrip(tripId, endingLatitude, endingLongitude) {
    try {
      const updatePayload = {
        end_time: new Date().toISOString(),
        status: 'ended'
      };

      if (endingLatitude === undefined || endingLongitude === undefined) {
        
        try {
          const { data: latestLoc } = await supabase
            .from('trip_locations')
            .select('latitude, longitude')
            .eq('trip_id', tripId)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestLoc) {
            updatePayload.ending_latitude = parseFloat(latestLoc.latitude);
            updatePayload.ending_longitude = parseFloat(latestLoc.longitude);
          }
        } catch (locErr) {
          console.warn('Could not fetch latest location for ending coordinates', locErr?.message);
        }
      } else {
        updatePayload.ending_latitude = parseFloat(endingLatitude);
        updatePayload.ending_longitude = parseFloat(endingLongitude);
      }

      const { data, error } = await supabase
        .from('trips')
        .update(updatePayload)
        .eq('trip_id', tripId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      
      if (data) {
        const driverId = data.driver_id;
        const busNumber = data.bus_number;
        await supabase.from('drivers').update({ status: 'active', current_bus: busNumber }).eq('driver_id', driverId);
        await supabase.from('buses').update({ status: 'assigned', current_driver: driverId }).eq('bus_number', busNumber);
      }

      return {
        success: true,
        data: {
          tripId: data.trip_id,
          driverId: data.driver_id,
          busNumber: data.bus_number,
          startTime: data.start_time,
          endTime: data.end_time,
          status: data.status,
          endingLatitude: data.ending_latitude ?? null,
          endingLongitude: data.ending_longitude ?? null
        }
      };
    } catch (error) {
      console.error('End trip error:', error);
      return {
        success: false,
        error: error?.message || 'Failed to end trip'
      };
    }
  }

  
  static async getTripById(tripId) {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('trip_id', tripId)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Trip not found'
        };
      }

      return {
        success: true,
        data: {
          tripId: data.trip_id,
          driverId: data.driver_id,
          busNumber: data.bus_number,
          startTime: data.start_time,
          endTime: data.end_time,
          status: data.status,
          startingLatitude: data.starting_latitude ?? null,
          startingLongitude: data.starting_longitude ?? null,
          endingLatitude: data.ending_latitude ?? null,
          endingLongitude: data.ending_longitude ?? null,
          createdAt: data.created_at
        }
      };
    } catch (error) {
      console.error('Get trip error:', error);
      return {
        success: false,
        error: error?.message || 'Service error'
      };
    }
  }
}
