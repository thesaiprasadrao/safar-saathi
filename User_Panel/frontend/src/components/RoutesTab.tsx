import React, { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";


let ROUTES_CACHE: RouteData[] | null = null;
let ROUTES_CACHE_TS = 0;
const ROUTES_TTL_MS = 60_000;
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { MapPin, Clock, Bus, Users, Navigation, Star } from "lucide-react";

interface StopInfo {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  estimatedTime?: string;
  amenities?: string[];
}

interface RouteData {
  id: string;
  name: string;
  startPoint: string;
  endPoint: string;
  totalStops: number;
  activeBuses?: number;
  avgTime?: string;
  status: "active" | "inactive" | "maintenance";
  stops: StopInfo[];
}

export function RoutesTab() {
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = async (opts: { background?: boolean } = {}) => {
    try {
      if (!opts.background) setLoading(true);
      const res = await fetch("http://localhost:5000/api/routes");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load routes");
      const mapped: RouteData[] = (json.data || []).map((r: any) => ({
        id: r.routeId,
        name: r.name || r.routeId,
        startPoint: r.start,
        endPoint: r.end,
        totalStops: r.totalStops || (r.stops ? r.stops.length : 0),
        status: r.isActive ? "active" : "inactive",
        stops: (r.stops || []).map((s: any) => ({
          id: s.stopId,
          name: s.name,
          coordinates: { lat: s.latitude, lng: s.longitude },
          estimatedTime: "",
          amenities: [],
        })),
      }));
      ROUTES_CACHE = mapped;
      ROUTES_CACHE_TS = Date.now();
      setRoutes(mapped);
      setError(null);
    } catch (e: any) {
      setError(e.message || "Failed to load routes");
    } finally {
      if (!opts.background) setLoading(false);
    }
  };

  useEffect(() => {
    
    if (ROUTES_CACHE && Date.now() - ROUTES_CACHE_TS < ROUTES_TTL_MS) {
      setRoutes(ROUTES_CACHE);
      setLoading(false);
      
      fetchRoutes({ background: true });
    } else {
      fetchRoutes();
    }
  }, []);

  
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchRoutes({ background: true });
    socket.on("routes-updated", handler);
    return () => {
      socket.off("routes-updated", handler);
    };
  }, [socket]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "inactive":
        return "bg-red-100 text-red-800";
      case "maintenance":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
      case "inactive":
        return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
      case "maintenance":
        return <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Loading routes...</h2>
          <p className="text-muted-foreground">Fetching routes from server</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Failed to load routes</h2>
          <p className="text-muted-foreground break-all">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">No routes found</h2>
          <p className="text-muted-foreground">The server returned an empty routes list. Verify database rows and API.</p>
        </div>
      </div>
    );
  }

  if (selectedRoute) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedRoute(null)}
          >
            ← Back to Routes
          </Button>
          <div>
            <h2 className="text-2xl font-bold">{selectedRoute.name}</h2>
            <p className="text-muted-foreground">
              {selectedRoute.startPoint} → {selectedRoute.endPoint}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bus className="w-5 h-5" />
                Route Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Stops:</span>
                <span className="font-semibold">
                  {selectedRoute.totalStops}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Buses:</span>
                <span className="font-semibold">
                  {selectedRoute.activeBuses ?? "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg. Time:</span>
                <span className="font-semibold">{selectedRoute.avgTime ?? "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <Badge className={getStatusColor(selectedRoute.status)}>
                  {getStatusIcon(selectedRoute.status)}
                  <span className="ml-1 capitalize">
                    {selectedRoute.status}
                  </span>
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {selectedRoute.avgTime}
                </div>
                <p className="text-sm text-muted-foreground">
                  Average journey time
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>First Bus:</span>
                  <span>5:30 AM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Last Bus:</span>
                  <span>11:30 PM</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Frequency:</span>
                  <span>Every 10-15 min</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Live Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {selectedRoute.activeBuses}
                </div>
                <p className="text-sm text-muted-foreground">
                  Buses currently running
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>On Time:</span>
                  <span className="text-green-600">85%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Delayed:</span>
                  <span className="text-yellow-600">12%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Cancelled:</span>
                  <span className="text-red-600">3%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Route Stops
            </CardTitle>
            <CardDescription>
              Complete list of stops along this route
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedRoute.stops.map((stop, index) => (
                <div
                  key={stop.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card/50"
                >
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    {index < selectedRoute.stops.length - 1 && (
                      <div className="w-0.5 h-8 bg-border mt-2"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">{stop.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {stop.estimatedTime}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {stop.coordinates.lat.toFixed(4)},{" "}
                        {stop.coordinates.lng.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {stop.amenities.map((amenity, idx) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="text-xs"
                        >
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">BMTC Bus Routes</h2>
        <p className="text-muted-foreground">
          Explore Bengaluru's public transportation network
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {routes.map((route) => (
          <Card
            key={route.id}
            className="group hover:shadow-lg transition-all duration-300 cursor-pointer"
            onClick={() => setSelectedRoute(route)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{route.name}</CardTitle>
                <Badge className={getStatusColor(route.status)}>
                  {getStatusIcon(route.status)}
                  <span className="ml-1 capitalize">{route.status}</span>
                </Badge>
              </div>
              <CardDescription>
                {route.startPoint} → {route.endPoint}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>{route.totalStops} stops</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-muted-foreground" />
                  <span>{route.activeBuses} active</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{route.avgTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>High demand</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="text-sm font-medium">4.2</span>
                  <span className="text-xs text-muted-foreground">(128)</span>
                </div>
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
