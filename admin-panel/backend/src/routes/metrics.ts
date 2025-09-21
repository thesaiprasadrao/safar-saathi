import { FastifyInstance } from 'fastify'
import { Kysely, sql } from 'kysely'
import { DB } from '../db'

export async function registerMetricsRoutes(app: FastifyInstance, db: Kysely<DB>) {
  app.get('/metrics', async () => {
    
    const routesCountRes = await sql<{ routes_count: number }>`select count(route_id)::int as routes_count from routes`.execute(db)
    const routes_count = (routesCountRes as any).rows?.[0]?.routes_count ?? 0

    
    const busesCountRes = await sql<{ buses_count: number }>`select count(bus_number)::int as buses_count from buses`.execute(db)
    const buses_count = (busesCountRes as any).rows?.[0]?.buses_count ?? 0

    
    const activeRes = await sql<{ cnt: number }>`
      select count(b.bus_number)::int as cnt
      from buses b
      left join trips t on t.bus_number = b.bus_number and lower(t.status) = 'active'
      where lower(coalesce(b.status, '')) = 'running' or t.trip_id is not null
    `.execute(db)
    const active_buses_count = (activeRes as any).rows?.[0]?.cnt ?? 0

    
    const recentRes = await sql<any>`
      select route_id, start, "end", updated_at, created_at
      from routes
      order by updated_at desc nulls last, created_at desc nulls last
      limit 5
    `.execute(db)
    const recent = (recentRes as any).rows || []

    const ids = recent.map((r: any) => r.route_id)
    let countsById = new Map<string, number>()
    if (ids.length) {
      const countsRes = await sql<any>`
        select route_id, count(stop_id)::int as cnt
        from route_stops
        where route_id = any(${ids})
        group by route_id
      `.execute(db)
      const rows = (countsRes as any).rows || []
      countsById = new Map(rows.map((r: any) => [r.route_id, Number(r.cnt)]))
    }

    const recentRoutes = recent.map((r: any) => ({
      routeId: r.route_id,
      start: r.start,
      end: r.end,
      stops: countsById.get(r.route_id) ?? 0,
    }))

    return {
      routesCount: Number(routes_count),
      busesCount: Number(buses_count),
      activeBusesCount: Number(active_buses_count),
      recentRoutes,
    }
  })
}
