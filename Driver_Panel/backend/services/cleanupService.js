
import { supabase } from '../config/database.js';



const CLEANUP_INTERVAL_MS = 30_000; 
const GRACE_PERIOD_MS = 60_000; 

async function getCompletedTripsNeedingCleanup() {
  
  const cutoffIso = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();
  const { data, error } = await supabase
    .from('trips')
    .select('trip_id')
.eq('status', 'ended')
    .lt('end_time', cutoffIso);

  if (error) throw error;
  return data || [];
}

async function cleanupTripLocations(tripId) {
  
  const { data: latest, error: latestErr } = await supabase
    .from('trip_locations')
    .select('location_id')
    .eq('trip_id', tripId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestErr) throw latestErr;

  
  if (!latest) return { success: true, deleted: 0 };

  const latestId = latest.location_id ?? latest.id;

  
  const { error: delErr, count } = await supabase
    .from('trip_locations')
    .delete({ count: 'exact' })
    .eq('trip_id', tripId)
    .neq('location_id', latestId);

  if (delErr) throw delErr;
  return { success: true, deleted: count ?? 0 };
}

export function startCleanupJob() {
  const run = async () => {
    try {
      const trips = await getCompletedTripsNeedingCleanup();
      if (!trips.length) return;

      for (const t of trips) {
        try {
          const result = await cleanupTripLocations(t.trip_id);
          if (result.success) {
            
            
            
          }
        } catch (err) {
          console.error(`Cleanup failed for trip ${t.trip_id}:`, err.message || err);
        }
      }
    } catch (err) {
      console.error('Cleanup scan failed:', err.message || err);
    }
  };

  
  setInterval(run, CLEANUP_INTERVAL_MS);
  
  setTimeout(run, 5_000);
}

