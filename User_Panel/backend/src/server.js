import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';


function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; 
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

dotenv.config();


const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const DRIVER_PANEL_URL = process.env.DRIVER_PANEL_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE; 

if (!SUPABASE_URL || (!SUPABASE_ANON_KEY && !SUPABASE_SERVICE_ROLE)) {
  console.warn('⚠️ SUPABASE_URL or keys not set. API will start, but data will be unavailable.');
}


const supabase = SUPABASE_URL && (SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE || SUPABASE_ANON_KEY)
  : null;


const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, DRIVER_PANEL_URL],
    methods: ['GET', 'POST']
  }
});


app.use(helmet());
app.use(cors({ origin: [FRONTEND_URL, DRIVER_PANEL_URL] }));
app.use(express.json());


const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '', 10) || 200
});
app.use(limiter);


io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});


async function fetchLatestLocationForTrip(tripId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('trip_locations')
    .select('latitude, longitude, timestamp')
    .eq('trip_id', tripId)
    .order('timestamp', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Error fetching latest location:', error);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}


app.get('/api/health', async (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});


app.get('/api/locations/active', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }

    
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('trip_id, bus_number')
      .eq('status', 'active');

    if (tripsError) {
      console.error('Failed to fetch active trips:', tripsError);
      return res.status(500).json({ success: false, error: 'Failed to fetch active trips' });
    }

    
    const results = await Promise.all((trips || []).map(async (t) => {
      const latest = await fetchLatestLocationForTrip(t.trip_id);
      if (!latest) return null;
      return {
        tripId: t.trip_id,
        busNumber: t.bus_number,
        latitude: latest.latitude,
        longitude: latest.longitude,
        timestamp: latest.timestamp
      };
    }));

    const data = results.filter(Boolean);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error in /api/locations/active:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/buses/active', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('trip_id, bus_number')
      .eq('status', 'active');
    if (tripsError) {
      console.error('Failed to fetch active trips:', tripsError);
      return res.status(500).json({ success: false, error: 'Failed to fetch active trips' });
    }
    const results = await Promise.all((trips || []).map(async (t) => {
      const latest = await fetchLatestLocationForTrip(t.trip_id);
      if (!latest) return null;
      return {
        busNumber: t.bus_number,
        tripId: t.trip_id,
        latitude: latest.latitude,
        longitude: latest.longitude,
        timestamp: latest.timestamp
      };
    }));
    const data = results.filter(Boolean);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Error in /api/buses/active:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/routes', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }

    
    const { data: routesData, error: routesErr } = await supabase
      .from('routes')
      .select('route_id, name, start, end, is_active')
      .order('route_id', { ascending: true });

    if (routesErr) {
      console.error('Failed to fetch routes:', routesErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch routes' });
    }

    const routeIds = (routesData || []).map((r) => r.route_id);
    if (!routeIds.length) return res.json({ success: true, data: [] });

    
    let stopsData = null;
    let stopsErr = null;
    try {
      const resp = await supabase
        .from('route_stops')
        .select('route_id, stop_id, name, latitude, longitude, sequence')
        .in('route_id', routeIds);
      stopsData = resp.data;
      stopsErr = resp.error;
    } catch (e) {
      stopsErr = e;
    }

    
    if (stopsErr) {
      console.warn('route_stops query failed, trying route_locations fallback:', stopsErr);
      try {
        const resp2 = await supabase
          .from('route_locations')
          .select('route_id, stop_id, name, latitude, longitude, sequence')
          .in('route_id', routeIds);
        stopsData = resp2.data;
        stopsErr = resp2.error;
      } catch (e2) {
        stopsErr = e2;
      }
    }

    if (stopsErr && !stopsData) {
      
      console.error('Failed to fetch route stops from both tables:', stopsErr);
      stopsData = [];
    }

    
    const byRoute = new Map();
    (stopsData || []).forEach((s) => {
      if (!byRoute.has(s.route_id)) byRoute.set(s.route_id, []);
      byRoute.get(s.route_id).push(s);
    });

    const normalized = (routesData || []).map((r) => {
      const stops = (byRoute.get(r.route_id) || []).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
      return {
        routeId: r.route_id,
        name: r.name,
        start: r.start,
        end: r.end,
        isActive: r.is_active,
        totalStops: stops.length,
        stops: stops.map((s) => ({
          stopId: s.stop_id,
          name: s.name,
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
          sequence: s.sequence ?? 0
        }))
      };
    });

    return res.json({ success: true, data: normalized });
  } catch (err) {
    console.error('Error in /api/routes:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/stops/search', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: { stops: [], routes: [] } });

    const [stopsResp, routesResp] = await Promise.all([
      supabase
        .from('route_stops')
        .select('stop_id, route_id, name, latitude, longitude, sequence')
        .ilike('name', `%${q}%`)
        .limit(50),
      supabase
        .from('routes')
        .select('route_id, name, start, end, is_active')
        .or(`route_id.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(50)
    ]);

    if (stopsResp.error) {
      console.error('Stop search error:', stopsResp.error);
      return res.status(500).json({ success: false, error: 'Failed to search stops' });
    }
    if (routesResp.error) {
      console.error('Route search error:', routesResp.error);
      return res.status(500).json({ success: false, error: 'Failed to search routes' });
    }

    return res.json({
      success: true,
      data: {
        stops: stopsResp.data || [],
        routes: routesResp.data || []
      }
    });
  } catch (err) {
    console.error('Error in /api/stops/search:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/stops/:stopId/etas', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const { stopId } = req.params;

    
    const { data: stop, error: stopErr } = await supabase
      .from('route_stops')
      .select('stop_id, name, latitude, longitude, route_id')
      .eq('stop_id', stopId)
      .single();
    if (stopErr || !stop) {
      return res.status(404).json({ success: false, error: 'Stop not found' });
    }

    
    const { data: buses, error: busesErr } = await supabase
      .from('buses')
      .select('bus_number')
      .eq('assigned_route', stop.route_id);
    if (busesErr) {
      console.error('Failed to fetch buses for route:', busesErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch buses' });
    }
    const busNumbers = (buses || []).map((b) => b.bus_number);
    if (busNumbers.length === 0) return res.json({ success: true, data: [] });

    
    const { data: trips, error: tripsErr } = await supabase
      .from('trips')
      .select('trip_id, bus_number')
      .eq('status', 'active')
      .in('bus_number', busNumbers);
    if (tripsErr) {
      console.error('Failed to fetch active trips for buses:', tripsErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch trips' });
    }

    
    const SPEED_KMPH = 25; 
    const results = await Promise.all((trips || []).map(async (t) => {
      const latest = await fetchLatestLocationForTrip(t.trip_id);
      if (!latest) return null;
      const distanceKm = haversineKm(latest.latitude, latest.longitude, stop.latitude, stop.longitude);
      const minutes = Math.max(1, Math.round((distanceKm / SPEED_KMPH) * 60));
      return {
        busNumber: t.bus_number,
        tripId: t.trip_id,
        etaMinutes: minutes,
        distanceKm: Number(distanceKm.toFixed(2)),
        stopId: stop.stop_id,
        stopName: stop.name
      };
    }));

    return res.json({ success: true, data: results.filter(Boolean) });
  } catch (err) {
    console.error('Error in /api/stops/:stopId/etas:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/buses/:busNumber/location/latest', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const { busNumber } = req.params;

    
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('trip_id, status')
      .eq('bus_number', busNumber)
      .eq('status', 'active')
      .single();

    if (tripErr || !trip) {
      return res.status(404).json({ success: false, error: 'No active trip for this bus' });
    }

    const latest = await fetchLatestLocationForTrip(trip.trip_id);
    if (!latest) return res.status(404).json({ success: false, error: 'No locations yet' });

    return res.json({
      success: true,
      data: {
        busNumber,
        tripId: trip.trip_id,
        latitude: latest.latitude,
        longitude: latest.longitude,
        timestamp: latest.timestamp
      }
    });
  } catch (err) {
    console.error('Error in /api/buses/:busNumber/location/latest:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/trips/:tripId/locations', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const { tripId } = req.params;
    const { since, limit } = req.query;

    let query = supabase
      .from('trip_locations')
      .select('latitude, longitude, timestamp')
      .eq('trip_id', tripId)
      .order('timestamp', { ascending: true });

    if (since) {
      
      query = query.gt('timestamp', since);
    }
    if (limit) {
      const limitNum = parseInt(String(limit), 10);
      if (!Number.isNaN(limitNum)) query = query.limit(limitNum);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Failed to fetch trip locations:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch trip locations' });
    }

    return res.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Error in /api/trips/:tripId/locations:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


app.get('/api/trips/:tripId/start', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase not configured' });
    }
    const { tripId } = req.params;

    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('trip_id', tripId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Trip not found' });
    }

    const keys = Object.keys(data);
    const findKey = (parts) => keys.find((k) => parts.every((p) => k.toLowerCase().includes(p)));

    
    const latKey = findKey(['start', 'lat']) || findKey(['starting', 'lat']) || findKey(['source', 'lat']);
    const lonKey = findKey(['start', 'lon']) || findKey(['start', 'lng']) || findKey(['starting', 'lon']) || findKey(['starting', 'lng']) || findKey(['source', 'lon']) || findKey(['source', 'lng']);

    if (!latKey || !lonKey || data[latKey] == null || data[lonKey] == null) {
      return res.status(404).json({ success: false, error: 'Start coordinates not found on trip' });
    }

    return res.json({
      success: true,
      data: {
        latitude: Number(data[latKey]),
        longitude: Number(data[lonKey])
      }
    });
  } catch (err) {
    console.error('Error in /api/trips/:tripId/start:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});


async function startRealtimeForwarders() {
  if (!supabase) return;

  
  const locChannel = supabase
    .channel('realtime:trip_locations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_locations' }, async (payload) => {
      const row = payload.new;
      const tripId = row.trip_id;

      
      const { data: trip, error: tripErr } = await supabase
        .from('trips')
        .select('bus_number')
        .eq('trip_id', tripId)
        .single();
      if (tripErr) {
        console.error('Failed to resolve trip -> bus_number:', tripErr);
        return;
      }

      io.emit('bus-location-update', {
        busNumber: trip.bus_number,
        tripId,
        latitude: row.latitude,
        longitude: row.longitude,
        timestamp: row.timestamp
      });
    })
    .subscribe((status) => {
      console.log('Realtime channel (trip_locations) status:', status);
    });

  
  const tripChannel = supabase
    .channel('realtime:trips')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, (payload) => {
      const newRow = payload.new;
      if (newRow.status === 'ended') {
        io.emit('bus-status-update', {
          busId: newRow.bus_number,
          status: 'offline',
          timestamp: new Date().toISOString()
        });
      }
    })
    .subscribe((status) => {
      console.log('Realtime channel (trips) status:', status);
    });

  
  const routesChannel = supabase
    .channel('realtime:routes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, (payload) => {
      io.emit('routes-updated', { routeId: payload.new?.route_id || payload.old?.route_id, type: payload.eventType });
    })
    .subscribe((status) => {
      console.log('Realtime channel (routes) status:', status);
    });

  const routeStopsChannel = supabase
    .channel('realtime:route_stops')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'route_stops' }, (payload) => {
      io.emit('routes-updated', { routeId: payload.new?.route_id || payload.old?.route_id, type: payload.eventType });
    })
    .subscribe((status) => {
      console.log('Realtime channel (route_stops) status:', status);
    });

  return { locChannel, tripChannel, routesChannel, routeStopsChannel };
}

startRealtimeForwarders().catch((e) => console.error('Failed to start realtime forwarders', e));

server.listen(PORT, () => {
  console.log(`🚌 Safar Saathi User Backend running on port ${PORT}`);
});
