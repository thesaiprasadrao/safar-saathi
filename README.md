# Safar Saathi — Real‑time Bus Tracking Platform

A full-stack, multi-panel system for real-time bus tracking with dedicated Admin, User, and Driver applications. This monorepo contains multiple backends and frontends built with modern web technologies.

- Admin Panel: Fastify + TypeScript + PostgreSQL (Kysely) backend and a Vite/React frontend
- User Panel: React (Vite) frontend and Node/Express + Socket.IO backend
- Driver Panel: React (Vite) frontend and Node/Express backend

---

## Table of Contents
- [Monorepo Structure](#monorepo-structure)
- [Feature Overview](#feature-overview)
  - [Admin Panel](#admin-panel)
  - [User Panel](#user-panel)
  - [Driver Panel](#driver-panel)
- [Tech Stack](#tech-stack)
- [Quick Start (Development)](#quick-start-development)
- [Environment Variables](#environment-variables)
  - [Admin Backend](#admin-backend-env)
  - [User Backend](#user-backend-env)
  - [Driver Frontend](#driver-frontend-env)
- [Common Scripts](#common-scripts)
- [APIs and Endpoints](#apis-and-endpoints)
  - [Admin Backend (Fastify)](#admin-backend-fastify)
  - [Driver Backend (Express)](#driver-backend-express)
  - [User Backend (Express + SocketIO)](#user-backend-express--socketio)
- [Database & Migrations](#database--migrations)
- [Development Notes](#development-notes)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Monorepo Structure
```
safar-saathi/
├── admin-panel/
│   ├── backend/      # Fastify + TypeScript + PostgreSQL (Kysely), Swagger
│   └── frontend/     # Vite + React + Radix UI components
├── User_Panel/
│   ├── backend/      # Express + Socket.IO + Supabase integration
│   └── frontend/     # Vite + React (Leaflet maps, Socket.IO client)
└── Driver_Panel/
    ├── backend/      # Express + Supabase + Socket.IO
    └── frontend/     # Vite + React (driver auth, trip mgmt, GPS)
```

---

## Feature Overview

### Admin Panel
- Fastify + TypeScript backend
- PostgreSQL via Kysely
- Swagger UI at /docs
- Admin auth (session cookie `st_admin`) and admin management script
- Endpoints for routes and buses (read/update)
- Health checks for API and DB

### User Panel
- Live bus tracking dashboard with interactive map (Leaflet)
- Route information and ETA display
- Real-time status updates via WebSockets
- Connection health indicators

### Driver Panel
- Driver authentication (driver ID + bus number)
- Trip lifecycle management (start/end)
- GPS location tracking (5s updates) and broadcast to backend
- Responsive, mobile-first UI (Tailwind)
- Demo mode fallback when backend is unavailable

---

## Tech Stack
- Frontend: React (Vite), Radix UI, Tailwind CSS, Leaflet/React-Leaflet, Socket.IO client
- Admin Backend: Fastify, TypeScript, Kysely, PostgreSQL, Zod, Swagger
- User/Driver Backends: Express, Socket.IO, Supabase (PostgreSQL), Helmet, CORS, rate limiting
- Tooling: TypeScript, tsx, nodemon, ESLint (driver frontend)

---

## Quick Start (Development)

Prerequisites
- Node.js 18+
- PostgreSQL database (for Admin Panel backend). Hosted DBs (e.g., Supabase) are supported.

Clone and navigate to the repo, then for each app:

Admin Panel
1) Backend (Fastify)
- cd admin-panel/backend
- cp .env.example .env  # configure DB and web origin
- npm install
- npm run migrate       # applies SQL migrations
- npm run dev           # http://localhost:3001, Swagger at /docs

2) Frontend (Vite/React)
- cd admin-panel/frontend
- npm install
- npm run batman        # Vite dev server (default http://localhost:5173)

User Panel
1) Backend (Express + Socket.IO)
- cd User_Panel/backend
- cp .env.example .env  # set PORT, FRONTEND_URL, DRIVER_PANEL_URL, SUPABASE_*
- npm install
- npm run dev           # default http://localhost:5000

2) Frontend (Vite/React)
- cd User_Panel/frontend
- npm install
- npm run dev           # dev server (commonly http://localhost:3000 or Vite default 5173)

Driver Panel
1) Backend (Express)
- cd Driver_Panel/backend
- npm install
- npm run dev           # default http://localhost:5001

2) Frontend (Vite/React)
- cd Driver_Panel/frontend
- npm install
- npm run dev

Tip: If ports conflict, adjust the Vite dev server port in each frontend’s Vite config or via env.

---

## Environment Variables

### Admin Backend Env
Example: admin-panel/backend/.env.example
```
PORT=3001
NODE_ENV=development
# PostgreSQL (either individual PG* or DATABASE_URL)
PGHOST=localhost
PGPORT=5432
PGDATABASE=safarsaathi
PGUSER=postgres
PGPASSWORD=postgres
# DATABASE_URL=postgresql://postgres:password@host:6543/dbname?sslmode=require
PGSSLMODE=require
PGPOOL_MAX=10
# CORS
WEB_ORIGIN=http://localhost:5173
# Auth
JWT_SECRET=replace_me
```

### User Backend Env
Example: User_Panel/backend/.env.example
```
PORT=5000
FRONTEND_URL=http://localhost:3000
DRIVER_PANEL_URL=http://localhost:3001
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE=
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200
```

### Driver Frontend Env
Example: Driver_Panel/frontend/.env
```
VITE_API_BASE_URL=http://localhost:5001/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Common Scripts

Admin Backend (admin-panel/backend)
- npm run dev — tsx watch server
- npm run build — tsc build
- npm start — run built server
- npm run migrate — apply SQL migrations
- npm run set-admin -- <admin_id> <password> — upsert admin and set password

Admin Frontend (admin-panel/frontend)
- npm run batman — start Vite dev server
- npm run build — production build

User Backend (User_Panel/backend)
- npm run dev — nodemon dev server
- npm start — production server

User Frontend (User_Panel/frontend)
- npm run dev — Vite dev server
- npm run build — production build

Driver Backend (Driver_Panel/backend)
- npm run dev — nodemon dev server
- npm start — production server

Driver Frontend (Driver_Panel/frontend)
- npm run dev — Vite dev server
- npm run build — build (tsc -b && vite build)
- npm run preview — preview production build
- npm run lint — ESLint

---

## APIs and Endpoints

### Admin Backend (Fastify)
- Auth
  - POST /auth/login — body: { adminId: string, password: string }
  - GET /me — current admin
  - POST /auth/logout
- Health
  - GET /healthz — API health
  - GET /healthz/db — DB connectivity
- Data
  - GET /routes
  - GET /routes/:routeId
  - GET /buses
  - PATCH /buses/:busNumber
- Docs
  - Swagger UI — /docs

Notes
- Sets HTTP-only session cookie st_admin (8h) on successful login
- CORS origin from WEB_ORIGIN (defaults to http://localhost:5173)

### Driver Backend (Express)
- Health
  - GET /health
- Auth
  - POST /api/auth/login
  - GET /api/auth/driver/:driverId
- Trips
  - GET /api/trips/active/:driverId
  - POST /api/trips/start
  - POST /api/trips/end
  - GET /api/trips/:tripId
- Locations
  - POST /api/locations
  - GET /api/locations/trip/:tripId
  - GET /api/locations/latest/:tripId
  - GET /api/locations/active

### User Backend (Express + SocketIO)
- REST
  - GET /api/health
  - GET /api/buses
  - GET /api/bus/:busId
- WebSocket Events
  - driver-register, location-update, start-trip, end-trip
  - subscribe-to-bus, bus-location-update, bus-status-update

---

## Database & Migrations
- Admin Backend uses PostgreSQL through Kysely.
  - Migrations are applied via npm run migrate (looks for db/migrations in the backend).
- Driver/User services integrate with Supabase (PostgreSQL) for persistence.

---

## Development Notes
- Node.js 18+ required across projects
- Vite dev servers commonly run on 5173 by default; User/Driver READMEs reference 3000/3001 respectively — adjust as needed
- When running multiple frontends simultaneously, ensure unique ports per app
- For geolocation features (Driver Frontend), serve via HTTPS in production; browsers may restrict location APIs over HTTP
- Admin auth uses JWT secret; set a strong value in production
- Configure CORS origins for each backend to match frontend hosts

---

## Troubleshooting
- Services won’t start
  - Verify Node version and run npm install in each app directory
  - Check ports and update configs to avoid conflicts
- No live location updates
  - Confirm backend WebSocket server is running
  - Check browser location permissions (Driver Frontend)
  - Inspect network/WebSocket console for errors
- Database connection issues
  - For Admin Backend, verify DATABASE_URL or PG* vars; set PGSSLMODE=require for hosted DBs
- Swagger not loading (Admin Backend)
  - Visit http://localhost:3001/docs and ensure server is in dev mode

---

## License
This repository contains multiple applications with their own licenses (MIT/ISC). See individual package.json/README files inside each subproject for exact license terms.
