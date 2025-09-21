import { useState, useEffect } from "react";
import { useSocket } from "./useSocket";
import { getBusDetails } from "../config/busMapping";

interface BusLocation {
  busId: string;
  driverId: string;
  route: string;
  location: {
    lat: number;
    lng: number;
    timestamp: string;
    accuracy?: number;
  };
}

interface BusData {
  id: string;
  tripId?: string;
  route: string;
  currentLocation: { lat: number; lng: number };
  eta: string;
  timeToDestination: string;
  nextStop: string;
  isActive: boolean;
  lastUpdate?: string;
}

export const useRealTimeBusData = () => {
  const { socket, isConnected } = useSocket();
  const [buses, setBuses] = useState<BusData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!socket) return;

    
    const handleLocationUpdate = (data: any) => {
      
      const busDetails = getBusDetails(data.busNumber || data.tripId);

      
      const updatedBus: BusData = {
        id: data.busNumber || data.tripId,
        tripId: data.tripId,
        route: busDetails
          ? busDetails.routeName
          : data.routeId || `Route ${data.tripId?.slice(-4) || "Unknown"}`,
        currentLocation: {
          lat: data.latitude,
          lng: data.longitude,
        },
        eta: "Live",
        timeToDestination: "Live",
        nextStop: "Live Tracking",
        isActive: true,
        lastUpdate: data.timestamp,
      };

      setBuses((prevBuses) => {
        const existingBusIndex = prevBuses.findIndex(
          (bus) => bus.id === updatedBus.id
        );

        if (existingBusIndex >= 0) {
          
          const updatedBuses = [...prevBuses];
          updatedBuses[existingBusIndex] = updatedBus;
          return updatedBuses;
        } else {
          
          return [...prevBuses, updatedBus];
        }
      });
    };

    
    const handleStatusUpdate = (data: any) => {
      if (data.status === "offline") {
        setBuses((prevBuses) =>
          prevBuses.map((bus) =>
            bus.id === data.busId ? { ...bus, isActive: false } : bus
          )
        );
      }
    };

    socket.on("bus-location-update", handleLocationUpdate);
    socket.on("bus-status-update", handleStatusUpdate);

    
    const reconcile = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/locations/active");
        const data = await response.json();
        if (data.success && data.data) {
          setBuses((prev) => {
            const byId = new Map(prev.map((b) => [b.id, b]));
            for (const location of data.data) {
              const current = byId.get(location.busNumber || location.tripId);
              const next: BusData = {
                id: location.busNumber || location.tripId,
                tripId: location.tripId,
                route: current?.route || `Route ${location.tripId?.slice(-4) || "Unknown"}`,
                currentLocation: { lat: location.latitude, lng: location.longitude },
                eta: current?.eta || "Live",
                timeToDestination: current?.timeToDestination || "Live",
                nextStop: current?.nextStop || "Live Tracking",
                isActive: true,
                lastUpdate: location.timestamp,
              };
              byId.set(next.id, next);
            }
            return Array.from(byId.values());
          });
        }
      } catch {}
    };

    
    const fetchInitialData = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/locations/active"
        );
        const data = await response.json();

        if (data.success && data.data) {
          const formattedBuses: BusData[] = data.data.map((location: any) => {
            const busDetails = getBusDetails(
              location.busNumber || location.tripId
            );
            return {
              id: location.busNumber || location.tripId,
              tripId: location.tripId,
              route: busDetails
                ? busDetails.routeName
                : `Route ${location.tripId?.slice(-4) || "Unknown"}`,
              currentLocation: {
                lat: location.latitude,
                lng: location.longitude,
              },
              eta: "Live",
              timeToDestination: "Live",
              nextStop: "Live Tracking",
              isActive: true,
              lastUpdate: location.timestamp,
            };
          });

          setBuses(formattedBuses);
        } else {
          setBuses([]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch initial bus data:", error);
        setIsLoading(false);
      }
    };

    fetchInitialData();

    
    const interval = setInterval(reconcile, 3000);

    return () => {
      clearInterval(interval);
      socket.off("bus-location-update", handleLocationUpdate);
      socket.off("bus-status-update", handleStatusUpdate);
    };
  }, [socket]);

  return { buses, isLoading, isConnected };
};
