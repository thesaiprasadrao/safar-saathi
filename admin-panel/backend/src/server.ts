import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import cookie from '@fastify/cookie'
import { createDb } from './db'
import { sql } from 'kysely'
import { listRoutes, getRouteDetail } from './repositories/routesRepo'
import { registerAuthRoutes } from './routes/auth'
import { registerRoutesCrud } from './routes/routes'
import { registerDevRoutes } from './routes/dev'
import { registerMetricsRoutes } from './routes/metrics'
import { registerDriversRoutes } from './routes/drivers'

const PORT = Number(process.env.PORT || 3001)
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173'
const ORIGIN_LIST = WEB_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)

export async function buildServer() {
  const app = Fastify({ logger: { transport: { target: 'pino-pretty' } } })
  const db = createDb()

  await app.register(sensible)
  await app.register(cookie)
  await app.register(cors, {
    origin: ORIGIN_LIST.length > 1 ? ORIGIN_LIST : WEB_ORIGIN,
    credentials: true
  })
  await app.register(swagger, {
    openapi: {
  info: { title: 'Safar Saathi API', version: '0.1.0' }
    }
  })
  await app.register(swaggerUi, { routePrefix: '/docs' })

  
  app.get('/healthz', async () => ({ ok: true }))
  app.get('/healthz/db', async () => {
    try {
      await sql`select 1`.execute(db)
      return { ok: true }
    } catch (e: any) {
      return {
        ok: false,
        code: e?.code,
        message: e?.message,
      }
    }
  })

  
  app.get('/routes', async () => listRoutes(db))

  
  app.get('/routes/:routeId', async (req, reply) => {
    const { routeId } = req.params as { routeId: string }
    const route = await getRouteDetail(db, routeId)
    if (!route) return reply.notFound('Route not found')
    return route
  })

  
  app.get('/buses', async () => {
    const buses = await db.selectFrom('buses')
      .select([
        'bus_number as id',
        'bus_number as plateNumber',
        'status',
        'assigned_route as assignedRoute',
        'current_driver as driver'
      ])
      .orderBy('bus_number')
      .execute()

    return buses.map(b => ({
      ...b,
      model: null,
      capacity: null,
      fuelLevel: null,
      lastMaintenance: null,
      mileage: null
    }))
  })

  
  app.post('/buses', async (req, reply) => {
    const body = req.body as Partial<{ busNumber: string; assignedRoute?: string | null; driver?: string | null; status?: string | null }>
    const busNumber = (body?.busNumber || '').trim()
    if (!busNumber) return reply.badRequest('busNumber is required')

    
    if (body.assignedRoute) {
      const exists = await db.selectFrom('routes').select('route_id').where('route_id', '=', body.assignedRoute).executeTakeFirst()
      if (!exists) return reply.badRequest('assignedRoute does not exist')
    }

    
    try {
      await db.insertInto('buses').values({
        bus_number: busNumber,
        assigned_route: body.assignedRoute ?? null,
        current_driver: body.driver ?? null,
        status: body.status ?? null,
      }).execute()
    } catch (e: any) {
      
      if (e?.code === '23505') return reply.conflict('Bus already exists')
      throw e
    }

    return {
      id: busNumber,
      plateNumber: busNumber,
      status: body.status ?? null,
      assignedRoute: body.assignedRoute ?? null,
      driver: body.driver ?? null,
      model: null,
      capacity: null,
      fuelLevel: null,
      lastMaintenance: null,
      mileage: null
    }
  })

  
  app.get('/tracking/active-buses', async () => {
    const rows = await sql<any>`
      select b.bus_number as id,
             b.bus_number as platenumber,
             b.status,
             b.assigned_route as assignedroute,
             b.current_driver as driver
      from buses b
      left join trips t on t.bus_number = b.bus_number and lower(t.status) = 'active'
      where lower(coalesce(b.status, '')) = 'running' or t.trip_id is not null
      order by b.bus_number
    `.execute(db)
    const raw = (rows as any).rows || []
    
    return raw.map((r: any) => ({
      id: r.id,
      plateNumber: r.platenumber ?? r.plateNumber ?? r.id,
      status: r.status ?? null,
      assignedRoute: r.assignedroute ?? r.assignedRoute ?? null,
      driver: r.driver ?? null,
    }))
  })

  
  app.get('/tracking/positions', async (req, reply) => {
    const { bus, since } = (req.query as any) || {}
    if (!bus) return reply.badRequest('bus is required')

    const sinceClause = since ? sql`and tl.timestamp > ${since}` : sql``
    const result = await sql<{
      latitude: number
      longitude: number
      recorded_at: string
    }>`
      select tl.latitude,
             tl.longitude,
             tl.timestamp as recorded_at
      from trip_locations tl
      inner join trips t on t.trip_id = tl.trip_id
      where t.bus_number = ${bus}
        and lower(t.status) = 'active'
        ${sinceClause}
      order by tl.timestamp asc
      limit 2000
    `.execute(db)

    return { positions: (result as any).rows || [] }
  })

  
  app.get('/tracking/trip-start', async (req, reply) => {
    const { bus } = (req.query as any) || {}
    if (!bus) return reply.badRequest('bus is required')

    
    const res = await sql<any>`
      select * from trips
      where bus_number = ${bus}
        and lower(status) = 'active'
      order by start_time asc nulls last
      limit 1
    `.execute(db)
    const row = (res as any).rows?.[0]
    if (!row) return reply.notFound('No active trip for this bus')

    const keys = Object.keys(row).map(k => k.toLowerCase())
    const findKey = (parts: string[]) => {
      const idx = keys.findIndex(k => parts.every(p => k.includes(p)))
      return idx >= 0 ? Object.keys(row)[idx] : null
    }

    const latKey = findKey(['start', 'lat']) || findKey(['starting', 'lat']) || findKey(['source', 'lat'])
    const lonKey = findKey(['start', 'lon']) || findKey(['start', 'lng']) || findKey(['starting', 'lon']) || findKey(['starting', 'lng']) || findKey(['source', 'lon']) || findKey(['source', 'lng'])

    if (!latKey || !lonKey || row[latKey] == null || row[lonKey] == null) {
      return reply.notFound('Start coordinates not found on trip')
    }

    return {
      latitude: Number(row[latKey]),
      longitude: Number(row[lonKey])
    }
  })


  
  app.patch('/buses/:busNumber', async (req, reply) => {
    const { busNumber } = req.params as { busNumber: string }
    const body = req.body as Partial<{ assignedRoute: string | null; driver: string | null }>

    
    if (body.assignedRoute) {
      const exists = await db.selectFrom('routes').select('route_id').where('route_id', '=', body.assignedRoute).executeTakeFirst()
      if (!exists) return reply.badRequest('assignedRoute does not exist')
    }

    const update: Record<string, any> = {}
    if (body.assignedRoute !== undefined) update.assigned_route = body.assignedRoute
    if (body.driver !== undefined) update.current_driver = body.driver

    if (Object.keys(update).length === 0) return { ok: true }

    const res = await db.updateTable('buses').set(update).where('bus_number', '=', busNumber).executeTakeFirst()
    if ((res as any).numUpdatedRows === 0n || (res as any).numUpdatedRows === 0) return reply.notFound('Bus not found')
    return { ok: true }
  })

  
  await registerAuthRoutes(app, db)
  await registerRoutesCrud(app, db)
  await registerDevRoutes(app, db)
  await registerMetricsRoutes(app, db)
  await registerDriversRoutes(app, db)

  return app
}

buildServer()
  .then(async app => {
    
    try {
      
      const db = createDb()
      await sql`select 1`.execute(db)
      app.log.info('Database connectivity check passed')
    } catch (e: any) {
      const cs = process.env.DATABASE_URL
      let host: string | undefined
      try { if (cs) host = new URL(cs).hostname } catch {}
      app.log.error({ code: e?.code, message: e?.message, host, hint: 'Verify DATABASE_URL/PG* env and network/DNS. For Supabase, ensure sslmode=require and correct host.' }, 'Database connectivity check failed')
    }
    return app.listen({ port: PORT, host: '0.0.0.0' })
  })
  .then(address => console.log(`API listening on ${address}`))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })