import React, { useEffect, useMemo, useState } from "react";
import cityConfig from "../config/cityConfig";
import { getBusDetails } from "../config/busMapping";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  MapPin,
  Clock,
  Navigation as NavigationIcon,
  Bus,
  Flag,
  Search,
  Plus,
  X,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";

interface StopData {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  routes: string[];
}

interface BusETA {
  busId: string;
  route: string;
  eta: string;
  timeToDestination: string;
  isClosest?: boolean;
}

type StopStatus = "On time" | "Delayed" | "Arrived" | "Departed" | "Skipped";

interface BusStopTimelineItem {
  index: number;
  name: string;
  eta: string; 
  departure?: string; 
  distanceFromSourceKm?: number;
  platform?: string;
  status: StopStatus;
  isCurrent?: boolean;
  isNext?: boolean;
}

interface BusTrackingDetails {
  busId: string;
  route: string;
  currentStopIndex: number;
  nextStopIndex: number;
  stops: BusStopTimelineItem[];
}


const mockStops: StopData[] = Object.entries(cityConfig.landmarks).map(
  ([landmarkName, landmark], index) => {
    
    const routes = Object.entries(cityConfig.transport.routes)
      .filter(([_, route]) => route.stops.includes(landmarkName))
      .map(([routeId, route]) => route.description);

    return {
      id: `ST-${String(index + 1).padStart(3, "0")}`,
      name: landmarkName,
      coordinates: { lat: landmark.lat, lng: landmark.lng },
      routes: routes.length > 0 ? routes : ["General Stop"],
    };
  }
);


const mockETAs: Record<string, BusETA[]> = mockStops.reduce((acc, stop) => {
  const etas: BusETA[] = [];

  
  stop.routes.forEach((routeDesc, index) => {
    if (routeDesc !== "General Stop") {
      etas.push({
        busId: `BUS-${String(index + 1).padStart(3, "0")}`,
        route: routeDesc,
        eta: `${Math.floor(Math.random() * 15) + 3} min`,
        timeToDestination: `${Math.floor(Math.random() * 30) + 15} min`,
      });
    }
  });

  acc[stop.id] = etas;
  return acc;
}, {} as Record<string, BusETA[]>);

export function StopsTab() {
  const [pickupPoint, setPickupPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedPickupStopId, setSelectedPickupStopId] = useState<string | null>(null);
  const [selectedDestStopId, setSelectedDestStopId] = useState<string | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<BusETA[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  
  type Suggestion = { text: string; category: string; icon: string; stopId?: string; routeId?: string };
  const [pickupSuggestions, setPickupSuggestions] = useState<Suggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Suggestion[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [pickupActiveIndex, setPickupActiveIndex] = useState(-1);
  const [destActiveIndex, setDestActiveIndex] = useState(-1);

  const fetchSuggestions = async (query: string, setter: (s: Suggestion[]) => void) => {
    const q = query.trim();
    if (!q) {
      setter([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/stops/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!json.success) {
        setter([]);
        return;
      }
      const suggestions: Suggestion[] = [];
      (json.data?.stops || []).forEach((s: any) => {
        suggestions.push({ text: s.name, category: "Bus Stop", icon: "📍", stopId: s.stop_id });
      });
      (json.data?.routes || []).forEach((r: any) => {
        suggestions.push({ text: r.name || r.route_id, category: "Route", icon: "🚌", routeId: r.route_id });
      });
      setter(suggestions.slice(0, 10));
    } catch {
      setter([]);
    }
  };

  
  const pickupDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const destDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    pickupDebounceRef.current = setTimeout(() => {
      if (showPickupSuggestions) fetchSuggestions(pickupPoint, setPickupSuggestions);
    }, 250);
    
    setSelectedPickupStopId(null);
    return () => {
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    };
    
  }, [pickupPoint, showPickupSuggestions]);

  useEffect(() => {
    if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    destDebounceRef.current = setTimeout(() => {
      if (showDestSuggestions) fetchSuggestions(destination, setDestSuggestions);
    }, 250);
    setSelectedDestStopId(null);
    return () => {
      if (destDebounceRef.current) clearTimeout(destDebounceRef.current);
    };
    
  }, [destination, showDestSuggestions]);
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState<BusETA | null>(null);
  const [lastStopIdSearched, setLastStopIdSearched] = useState<string | null>(null);

  
  const generateBusTrackingData = (
    busId: string
  ): BusTrackingDetails | null => {
    const busDetails = getBusDetails(busId);
    if (!busDetails) return null;

    
    const route = cityConfig.transport.routes[busDetails.routeId];
    if (!route) return null;

    
    const stops = route.stops.map((stopName, index) => {
      const landmark = cityConfig.landmarks[stopName];
      const currentTime = new Date();
      const baseTime = new Date(currentTime.getTime() + index * 5 * 60000); 

      
      const currentStopIndex = Math.floor(Math.random() * 3) + 1;
      const isCurrent = index === currentStopIndex;
      const isNext = index === currentStopIndex + 1;

      let status: StopStatus = "On time";
      if (index < currentStopIndex) status = "Departed";
      else if (isCurrent) status = "Arrived";
      else if (Math.random() < 0.1) status = "Delayed";

      return {
        index: index + 1,
        name: stopName,
        eta: baseTime.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        departure:
          index < currentStopIndex
            ? baseTime.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : undefined,
        distanceFromSourceKm: index * 2.5 + Math.random() * 2, 
        platform: `${String.fromCharCode(65 + (index % 26))}${
          (index % 10) + 1
        }`, 
        status,
        isCurrent,
        isNext,
      };
    });

    return {
      busId,
      route: busDetails.routeName,
      currentStopIndex: stops.findIndex((s) => s.isCurrent) + 1,
      nextStopIndex: stops.findIndex((s) => s.isNext) + 1,
      stops,
    };
  };

  const addIntermediateStop = () => {
    setIntermediateStops([...intermediateStops, ""]);
  };

  const removeIntermediateStop = (index: number) => {
    setIntermediateStops(intermediateStops.filter((_, i) => i !== index));
  };

  const updateIntermediateStop = (index: number, value: string) => {
    const updated = [...intermediateStops];
    updated[index] = value;
    setIntermediateStops(updated);
  };

  const handleSearch = async (explicitStopId?: string) => {
    const resolvedStopId = explicitStopId || selectedPickupStopId;
    setIsSearching(true);
    try {
      let stopId = resolvedStopId;
      let stopName = pickupPoint;
      if (!stopId) {
        
        if (!pickupPoint.trim()) {
          setIsSearching(false);
          return;
        }
        const searchRes = await fetch(
          `http://localhost:5000/api/stops/search?q=${encodeURIComponent(pickupPoint)}`
        );
        const searchJson = await searchRes.json();
        const stops = searchJson?.data?.stops || [];
        if (stops.length === 0) {
          setSearchResults([]);
          setIsSearching(false);
          return;
        }
        stopId = stops[0].stop_id;
        stopName = stops[0].name;
      }

      
      const etaRes = await fetch(
        `http://localhost:5000/api/stops/${encodeURIComponent(stopId as string)}/etas`
      );
      const etaJson = await etaRes.json();
      const results: BusETA[] = (etaJson.data || []).map((e: any) => ({
        busId: e.busNumber,
        route: stopName,
        eta: `${e.etaMinutes} min`,
        timeToDestination: e.etaMinutes ? `${e.etaMinutes + 20} min` : "-",
      }));
      setSearchResults(results);
      setLastStopIdSearched(stopId || null);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  
  useEffect(() => {
    if (!lastStopIdSearched) return;
    const id = setInterval(async () => {
      try {
        const etaRes = await fetch(`http://localhost:5000/api/stops/${encodeURIComponent(lastStopIdSearched)}/etas`);
        const etaJson = await etaRes.json();
        const results: BusETA[] = (etaJson.data || []).map((e: any) => ({
          busId: e.busNumber,
          route: searchResults[0]?.route || "",
          eta: `${e.etaMinutes} min`,
          timeToDestination: e.etaMinutes ? `${e.etaMinutes + 20} min` : "-",
        }));
        setSearchResults(results);
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, [lastStopIdSearched]);

  const openTrackModal = (bus: BusETA) => {
    setSelectedBus(bus);
    setIsTrackModalOpen(true);
  };

  const statusColorClass = (status: StopStatus) => {
    switch (status) {
      case "On time":
        return "bg-green-500 border-green-500";
      case "Delayed":
        return "bg-yellow-500 border-yellow-500";
      case "Arrived":
        return "bg-blue-500 border-blue-500";
      case "Departed":
        return "bg-gray-400 border-gray-400";
      case "Skipped":
        return "bg-red-500 border-red-500";
      default:
        return "bg-gray-300 border-gray-300";
    }
  };

  const statusPillClasses = (status: StopStatus) => {
    switch (status) {
      case "Arrived":
        return "bg-green-500 text-white";
      case "Departed":
        return "bg-gray-500 text-white";
      case "On time":
        return "bg-blue-500 text-white";
      case "Delayed":
        return "bg-red-500 text-white";
      case "Skipped":
        return "bg-red-500 text-white";
      default:
        return "bg-muted text-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <NavigationIcon className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-2">Stops & ETA</h2>
        <p className="text-muted-foreground">
          Plan your journey and get accurate arrival times
        </p>
      </div>

      {}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle>Plan Your Journey</CardTitle>
          <CardDescription>
            Enter your pickup and destination points to find buses with ETA
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup Point</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                <Input
                  id="pickup"
                  placeholder="Enter pickup location"
                  value={pickupPoint}
                  onChange={(e) => {
                    setPickupPoint(e.target.value);
                    setShowPickupSuggestions(true);
                    setPickupActiveIndex(-1);
                  }}
                  className="pl-10"
                  onFocus={() => setShowPickupSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowPickupSuggestions(false), 120)
                  }
                  onKeyDown={(e) => {
                    if (!showPickupSuggestions) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setPickupActiveIndex((i) =>
                        Math.min(i + 1, pickupSuggestions.length - 1)
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setPickupActiveIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (pickupActiveIndex >= 0) {
                        const choice = pickupSuggestions[pickupActiveIndex];
                        if (choice) {
                          setPickupPoint(choice.text);
                          setSelectedPickupStopId(choice.stopId || null);
                          setShowPickupSuggestions(false);
                          if (choice.stopId) handleSearch(choice.stopId);
                        }
                      } else {
                        setShowPickupSuggestions(false);
                        handleSearch();
                      }
                    } else if (e.key === "Escape") {
                      setShowPickupSuggestions(false);
                    }
                  }}
                />
                {showPickupSuggestions && pickupSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/50 bg-popover shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    <ul className="py-1">
                      {pickupSuggestions.map((suggestion, idx) => (
                        <li
                          key={`${suggestion.text}-${idx}`}
                          className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                            idx === pickupActiveIndex
                              ? "bg-muted/60"
                              : "hover:bg-muted/40"
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPickupPoint(suggestion.text);
                            setSelectedPickupStopId(suggestion.stopId || null);
                            setShowPickupSuggestions(false);
                            if (suggestion.stopId) {
                              handleSearch(suggestion.stopId);
                            }
                          }}
                          onMouseEnter={() => setPickupActiveIndex(idx)}
                        >
                          <span className="text-lg">{suggestion.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium">{suggestion.text}</div>
                            <div className="text-xs text-muted-foreground">
                              {suggestion.category}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-red-600 w-4 h-4" />
                <Input
                  id="destination"
                  placeholder="Enter destination"
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setShowDestSuggestions(true);
                    setDestActiveIndex(-1);
                  }}
                  className="pl-10"
                  onFocus={() => setShowDestSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowDestSuggestions(false), 120)
                  }
                  onKeyDown={(e) => {
                    if (!showDestSuggestions) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setDestActiveIndex((i) =>
                        Math.min(i + 1, destSuggestions.length - 1)
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setDestActiveIndex((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && destActiveIndex >= 0) {
                      e.preventDefault();
                      const choice = destSuggestions[destActiveIndex];
                      if (choice) {
                        setDestination(choice.text);
                        setSelectedDestStopId(choice.stopId || null);
                        setShowDestSuggestions(false);
                      }
                    } else if (e.key === "Escape") {
                      setShowDestSuggestions(false);
                    }
                  }}
                />
                {showDestSuggestions && destSuggestions.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/50 bg-popover shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    <ul className="py-1">
                      {destSuggestions.map((suggestion, idx) => (
                        <li
                          key={`${suggestion.text}-${idx}`}
                          className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                            idx === destActiveIndex
                              ? "bg-muted/60"
                              : "hover:bg-muted/40"
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setDestination(suggestion.text);
                            setSelectedDestStopId(suggestion.stopId || null);
                            setShowDestSuggestions(false);
                          }}
                          onMouseEnter={() => setDestActiveIndex(idx)}
                        >
                          <span className="text-lg">{suggestion.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium">{suggestion.text}</div>
                            <div className="text-xs text-muted-foreground">
                              {suggestion.category}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {}
          {intermediateStops.length > 0 && (
            <div className="space-y-2">
              <Label>Intermediate Stops</Label>
              {intermediateStops.map((stop, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-600 w-4 h-4" />
                    <Input
                      placeholder={`Intermediate stop ${index + 1}`}
                      value={stop}
                      onChange={(e) =>
                        updateIntermediateStop(index, e.target.value)
                      }
                      className="pl-10"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => removeIntermediateStop(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={addIntermediateStop}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Stop
            </Button>
            <Button
              onClick={() => handleSearch()}
              disabled={(!pickupPoint.trim() && !selectedPickupStopId) || isSearching}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-purple-600"
            >
              <Search className="w-4 h-4" />
              {isSearching ? "Searching..." : "Find Buses"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {}
      {searchResults.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Available Buses</CardTitle>
            <CardDescription>
              Buses serving your pickup point with estimated arrival times
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((result) => (
                <Card
                  key={result.busId}
                  className="group hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 bg-card/30 backdrop-blur-sm border-border/50"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{result.busId}</CardTitle>
                      {result.isClosest && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400"
                        >
                          Closest Available
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {result.route}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">ETA</p>
                          <p className="font-semibold">{result.eta}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <NavigationIcon className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            To Destination
                          </p>
                          <p className="font-semibold">
                            {result.timeToDestination}
                          </p>
                        </div>
                      </div>
                    </div>

                    {result.isClosest && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded text-sm text-yellow-700 dark:text-yellow-400">
                        No direct bus found. This is the nearest available
                        option.
                      </div>
                    )}

                    <Button
                      className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 group-hover:shadow-lg transition-all duration-300"
                      onClick={() => openTrackModal(result)}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      Track Bus
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {}
      <Dialog open={isTrackModalOpen} onOpenChange={setIsTrackModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bus className="w-5 h-5" />
              {selectedBus?.busId} - Live Tracking
            </DialogTitle>
            <DialogDescription>{selectedBus?.route}</DialogDescription>
          </DialogHeader>

          {selectedBus && (
            <div
              className="relative overflow-y-auto"
              style={{ height: "calc(85vh - 120px)" }}
            >
              {}
              <div className="space-y-2 p-1">
                {generateBusTrackingData(selectedBus.busId)?.stops.map(
                  (s, index, arr) => (
                    <Card
                      key={s.index}
                      className="bg-card/50 backdrop-blur-sm border-border/50"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full ${
                                  s.isCurrent
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                } flex items-center justify-center text-sm font-semibold`}
                              >
                                {s.isCurrent ? (
                                  <Bus className="w-4 h-4" />
                                ) : (
                                  index + 1
                                )}
                              </div>
                              {index < arr.length - 1 && (
                                <div className="w-0.5 h-8 bg-border mt-2"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-[14px] truncate">
                                {s.name}
                              </h4>
                              <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> ETA {s.eta}
                                </span>
                                {s.departure && <span>Dep {s.departure}</span>}
                                {typeof s.distanceFromSourceKm === "number" && (
                                  <span>
                                    {s.distanceFromSourceKm.toFixed(0)} km
                                  </span>
                                )}
                                {s.platform && <span>PF {s.platform}</span>}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${statusPillClasses(
                              s.status
                            )}`}
                          >
                            {s.status}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
