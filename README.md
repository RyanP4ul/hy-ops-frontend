# HyOps frontend

The frontend is a Next.js 16 application using React 19, TypeScript, Tailwind
CSS, TanStack Query, and the App Router. It provides the HyOps operations
dashboard for authentication, products, inventory, orders, deliveries,
warehouses, vehicles, users, notifications, audit logs, sessions, and the
calendar.

## Requirements

- Node.js 20 or newer
- Bun (recommended) or npm
- The backend running on `http://localhost:5173`

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create `.env.local`:

   ```env
   APP_ENV=development
   APP_NAME=HyOps
   NEXT_PUBLIC_API_URL=http://localhost:5173
   NEXT_PUBLIC_DEBUG=false
   ```

3. Start the development server:

   ```bash
   bun run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Next.js development server |
| `bun run build` | Create a production build |
| `bun run start` | Serve the production build |
| `bun run lint` | Run ESLint |

## API and authentication

Browser requests use the `/api/*` path. `next.config.ts` rewrites those
requests to the backend URL from `API_URL`, which defaults to
`http://localhost:5173`. Authentication uses HTTP-only cookies issued by the
backend, so requests that need a session must include credentials.

The websocket dashboard connection uses `ws://localhost:5173/ws` during local
development. Make sure the backend is running before opening protected panel
pages.

## Project structure

```text
app/
  page.tsx                    Login page
  (protected)/panel/          Authenticated operations screens
components/                   Shared UI, providers, and request helpers
lib/                          Authentication and utility helpers
public/                       Static assets
next.config.ts                Backend API rewrite
```

Protected dashboard pages are under
`app/(protected)/panel`, including `/panel/products`, `/panel/inventory`,
`/panel/orders`, `/panel/deliveries`, `/panel/delivery-schedules`,
`/panel/warehouses`, `/panel/vehicles`, `/panel/users`, `/panel/calendar`,
`/panel/archives`, `/panel/audit-logs`, and `/panel/sessions-and-logs`.

## Production

Set `API_URL` to the reachable backend origin, build the application, and run:

```bash
bun run build
bun run start
```

Use HTTPS in production and ensure the backend CORS and cookie settings allow
the deployed frontend origin.
