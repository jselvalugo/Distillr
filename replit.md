# OakCellar Distillery OS

## Overview

OakCellar Distillery OS is a local-only platform for craft distillery operations. It supports production batch tracking, inventory and lot movement, barrel lifecycle management, compliance readiness, and TTB report packet generation for local review and export.

## Security and Runtime Posture

- Server binds to `127.0.0.1` only.
- Server rejects non-loopback requests and only accepts `Host` headers for `localhost`, `127.0.0.1`, or `::1` (DNS rebinding protection).
- Runtime egress guard blocks outbound network requests except loopback hosts (`localhost`, `127.0.0.1`, `::1`).
- No Google Sheets, no external automation connectors, and no third-party API integrations.
- Frontend shell avoids external fonts and remote assets.

### Overrides (Not Recommended)

- Set `ALLOW_REMOTE=true` to allow binding to a non-loopback host (e.g. `HOST=0.0.0.0`).
- Set `LOCAL_ONLY_MODE=false` to disable the outbound egress guard.
- Set `ADMIN_PASSWORD` (and optionally `ADMIN_EMAIL`, `ADMIN_NAME`) to control first-boot admin credentials.

## System Architecture

### Frontend
- React + TypeScript
- Wouter routing
- TanStack React Query for internal API state
- Tailwind CSS + Radix/shadcn components

Primary pages:
- Dashboard
- Batch Schedule (`/schedule`)
- Inventory (`/inventory`)
- Barrels (`/barrels`)
- TTB Reports (`/reports`)
- Sales Orders (`/sales-orders`)
- Native Calculator (`/calculator`)
- Partners/Facilities/Staff/Compliance
- Local Settings (`/settings`)

### Backend
- Express + TypeScript
- Internal REST API only (`client -> localhost backend`)
- Zod validation for payloads and shared types

Core local endpoints:
- `/api/jobs`
- `/api/clients`
- `/api/properties`
- `/api/compliance`
- `/api/inventory/*`
- `/api/barrels/*`
- `/api/reports/ttb/*`
- `/api/sales-orders`
- `/api/calculator/*`

Decommissioned endpoints return `410 Gone`:
- `/api/integrations/*`
- `/api/automations*`

### Data Storage
- Local PostgreSQL is the only source of truth.
- Table initialization is handled in `server/db.ts`.
- Repository implementation is in `server/storage.ts`.
- Auth storage is in `server/auth-storage.ts`.

### Shared Types
- Shared schemas and types live in `shared/schema.ts`.
- Import alias: `@shared/*`.

## Testing Baseline

- `npm run check` for type checks
- `npm run test` for server tests, including local-only egress guard tests
- `npm run build` for client/server production build validation

## Reporting Notes

- Set `EXCISE_TAX_RATE_USD_PER_PROOF_GALLON` (number) to enable excise tax due estimation for the 5000.24 packet.
