
type RouteListItem = { routeId: string; start: string; end: string; name?: string | null; stopsCount: number }

export const store = {
  routes: null as null | RouteListItem[],
  buses: null as null | any[],
  metrics: null as null | { routesCount: number; busesCount: number; activeBusesCount: number; recentRoutes: Array<{ routeId: string; start: string; end: string; stops: number }> },
}
