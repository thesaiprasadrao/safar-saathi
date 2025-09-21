import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { TrackingAPI } from '../lib/api';
import { io, Socket } from 'socket.io-client';


function useLeaflet() {
  const [L, setL] = useState<any>(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      
      const cssId = 'leaflet-css'
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link')
        link.id = cssId
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
      }
      const leaflet = await import('leaflet')
      
      
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      if (mounted) setL(leaflet)
    })()
    return () => { mounted = false }
  }, [])
  return L
}

export function TrackingPage() {
  const [activeBuses, setActiveBuses] = useState<Array<{ id: string; plateNumber: string; driver: string | null; assignedRoute: string | null }>>([])
  const [selectedBus, setSelectedBus] = useState<string | null>(null)
  const [since, setSince] = useState<string | undefined>(undefined)
  const L = useLeaflet()
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const polyRef = useRef<any>(null)

  
  const [pathPoints, setPathPoints] = useState<Array<[number, number]>>([])
  const [currentPoint, setCurrentPoint] = useState<[number, number] | null>(null)
  const queueRef = useRef<Array<{ pt: [number, number]; ts: number | null }>>([])
  const animRef = useRef<{ running: boolean; start: [number, number] | null; target: [number, number] | null; startTime: number; duration: number; raf: number | null }>({ running: false, start: null, target: null, startTime: 0, duration: 0, raf: null })
  const prevTsRef = useRef<number | null>(null)
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const startAnim = (defaultDurationMs: number) => {
    if (animRef.current.running) return
    const nextItem = queueRef.current.shift()
    if (!nextItem) return
    const next = nextItem.pt
    const nextTs = nextItem.ts
    const start = currentPoint || next
    const target = next
    let duration = defaultDurationMs
    if (prevTsRef.current && nextTs) {
      duration = clamp(nextTs - prevTsRef.current, 200, 6000)
    }
    animRef.current = { running: true, start, target, startTime: performance.now(), duration, raf: null }
    const step = () => {
      const { running, start: s, target: t, startTime, duration } = animRef.current
      if (!running || !s || !t) return
      const pct = Math.min(1, (performance.now() - startTime) / duration)
      const lat = lerp(s[0], t[0], pct)
      const lng = lerp(s[1], t[1], pct)
      setCurrentPoint([lat, lng])
      if (pct >= 1) {
        setPathPoints(prev => [...prev, t])
        prevTsRef.current = nextTs ?? prevTsRef.current
        animRef.current.running = false
        animRef.current.raf = null
        startAnim(defaultDurationMs)
        return
      }
      animRef.current.raf = requestAnimationFrame(step)
    }
    animRef.current.raf = requestAnimationFrame(step)
  }
  const enqueue = (pt: [number, number], recordedAtIso?: string) => {
    const lastStatic = pathPoints[pathPoints.length - 1]
    const lastQueued = queueRef.current[queueRef.current.length - 1]?.pt
    const lastAny = lastQueued || lastStatic || currentPoint
    if (lastAny && lastAny[0] === pt[0] && lastAny[1] === pt[1]) return
    const ts = recordedAtIso ? Date.parse(recordedAtIso) : null
    queueRef.current.push({ pt, ts })
    startAnim(1000) 
  }

  
  useEffect(() => {
    let stop = false
    const tick = async () => {
      try {
        const buses = await TrackingAPI.activeBuses()
        if (stop) return
        setActiveBuses(buses)
        
        if (selectedBus && !buses.find(b => b.id === selectedBus)) {
          setSelectedBus(null)
          setPositions([])
          setSince(undefined)
        }
      } catch {}
      if (!stop) setTimeout(tick, 10000)
    }
    tick()
    return () => { stop = true }
  }, [selectedBus])

  
  const initialLoadedRef = useRef(false)
  const sinceRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!selectedBus) return
    initialLoadedRef.current = false
    ;(async () => {
      try {
        
        setPathPoints([])
        setCurrentPoint(null)
        queueRef.current = []
        prevTsRef.current = null
        setSince(undefined)

        
        let startPt: [number, number] | null = null
        try {
          const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3011'}/tracking/trip-start?bus=${encodeURIComponent(selectedBus)}`, { credentials: 'include' })
          if (resp.ok) {
            const js = await resp.json()
            if (js && typeof js.latitude === 'number' && typeof js.longitude === 'number') {
              startPt = [js.latitude, js.longitude]
            }
          }
        } catch {}

        
        const res = await TrackingAPI.positions(selectedBus)
        const pts = (res.positions || [])
        if (pts.length) {
          const all = pts.map(p => ([p.latitude, p.longitude] as [number, number]))
          
          const base = startPt ? [startPt, ...all.slice(0, -1)] : all.slice(0, -1)
          const last = all[all.length - 1]
          setPathPoints(base)
          setCurrentPoint(last)
          const lastTsIso = pts[pts.length - 1].recorded_at
          prevTsRef.current = Date.parse(lastTsIso)
          sinceRef.current = lastTsIso
          setSince(lastTsIso)
        } else if (startPt) {
          setPathPoints([])
          setCurrentPoint(startPt)
        }
      } finally {
        initialLoadedRef.current = true
      }
    })()
  }, [selectedBus])

  
  useEffect(() => {
    const USER_BACKEND = (import.meta as any).env?.VITE_USER_BACKEND_URL || 'http://localhost:5000'
    const s: Socket = io(USER_BACKEND, { transports: ['websocket'], autoConnect: true })
    const handler = (payload: any) => {
      if (!payload || !payload.busNumber) return
      if (!selectedBus || payload.busNumber !== selectedBus) return
      enqueue([payload.latitude, payload.longitude], payload.timestamp)
      prevTsRef.current = payload.timestamp ? Date.parse(payload.timestamp) : prevTsRef.current
      sinceRef.current = payload.timestamp || sinceRef.current
    }
    s.on('bus-location-update', handler)
    return () => { try { s.off('bus-location-update', handler); s.close() } catch {} }
  }, [selectedBus])

  
  useEffect(() => {
    if (!selectedBus) return
    let lastDataTs = Date.now()
    const id = setInterval(async () => {
      if (!initialLoadedRef.current) return
      try {
        
        let sinceForQuery = sinceRef.current
        if (sinceForQuery) {
          const d = new Date(sinceForQuery)
          if (!isNaN(d.getTime())) {
            d.setSeconds(d.getSeconds() - 2)
            sinceForQuery = d.toISOString()
          }
        }
        const res = await TrackingAPI.positions(selectedBus, sinceForQuery)
        const newPts = res.positions || []
        if (newPts.length) {
          newPts.forEach(p => enqueue([p.latitude, p.longitude], p.recorded_at))
          const lastIso = newPts[newPts.length - 1].recorded_at
          prevTsRef.current = Date.parse(lastIso)
          sinceRef.current = lastIso
          setSince(lastIso)
          lastDataTs = Date.now()
        } else {
          
          if (Date.now() - lastDataTs > 12000) {
            const full = await TrackingAPI.positions(selectedBus)
            const pts = full.positions || []
            if (pts.length) {
              const all = pts.map(p => ([p.latitude, p.longitude] as [number, number]))
              const last = all[all.length - 1]
              setPathPoints(all.slice(0, -1))
              setCurrentPoint(last)
              const lastIso = pts[pts.length - 1].recorded_at
              prevTsRef.current = Date.parse(lastIso)
              sinceRef.current = lastIso
              setSince(lastIso)
              lastDataTs = Date.now()
            }
          }
        }
      } catch {}
    }, 1000)
    return () => clearInterval(id)
  }, [selectedBus])

  
  useEffect(() => {
    if (!L) return
    if (!mapRef.current) {
      mapRef.current = L.map('live-map', { center: [12.9716, 77.5946], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current)
    }
    const latlng = currentPoint || pathPoints[pathPoints.length - 1]
    if (latlng) {
      if (!markerRef.current) {
        markerRef.current = L.marker(latlng).addTo(mapRef.current)
      } else {
        markerRef.current.setLatLng(latlng)
      }
      const all = currentPoint ? [...pathPoints, currentPoint] : pathPoints
      if (!polyRef.current) {
        polyRef.current = L.polyline(all, { color: 'black', weight: 4, opacity: 0.85 }).addTo(mapRef.current)
      } else {
        polyRef.current.setLatLngs(all)
      }
      
      const z = mapRef.current.getZoom()
      const targetZoom = z < 16 ? 16 : z
      mapRef.current.setView(latlng, targetZoom, { animate: true })
    } else {
      if (polyRef.current) { polyRef.current.remove(); polyRef.current = null }
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
    }
  }, [L, currentPoint, pathPoints])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gradient-primary tracking-tight">Tracking</h2>
          <p className="text-lg text-muted-foreground">Active buses and live locations</p>
        </div>
        <Badge className="bg-gradient-primary text-white">Live</Badge>
      </div>

      {}
      <Card className="card-elevated border-0">
        <CardContent className="p-4">
          {activeBuses.length === 0 ? (
            <div className="text-muted-foreground">No running buses.</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {activeBuses.map(b => (
                <button
                  key={b.id}
                  onClick={() => {
                    setSelectedBus(b.id)
                    
                    setPathPoints([])
                    setCurrentPoint(null)
                    queueRef.current = []
                    prevTsRef.current = null
                    if (animRef.current.raf) cancelAnimationFrame(animRef.current.raf!)
                    animRef.current = { running: false, start: null, target: null, startTime: 0, duration: 0, raf: null }
                    setSince(undefined)
                  }}
                  className={`px-3 py-2 rounded-md border ${selectedBus === b.id ? 'border-primary text-primary' : 'border-muted-foreground/20'}`}
                  title={`Route: ${b.assignedRoute || '-'} | Driver: ${b.driver || '-'}`}
                >
                  {b.plateNumber}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {}
      <Card className="w-full card-elevated border-0">
        <CardContent className="p-0">
          <div id="live-map" className="min-h-[500px] rounded-xl overflow-hidden" />
        </CardContent>
      </Card>
    </div>
  )
}