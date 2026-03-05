# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ProactiveCommuterAgent** is a mobile app + backend service that proactively monitors UK commute routes and sends timely push notifications about transport disruptions (delays, cancellations, engineering works) before the user needs to check manually. It combines on-device departure learning with backend-driven transport checks and notifications.

## Architecture

**Hybrid architecture**: On-device learning (geofencing, departure time observation) + backend checks/notifications.

- **Mobile**: Flutter (Dart) - `/mobile/`
- **Backend**: TypeScript + NestJS - `/backend/`
- **Shared types**: TypeScript package - `/shared/`
- **Database**: PostgreSQL (backend)
- **Job queue**: BullMQ with Redis (backend)
- **Push notifications**: Firebase Cloud Messaging (FCM)

## Monorepo Structure

```
/backend     - NestJS backend (TypeScript)
/mobile      - Flutter mobile app (Dart)
/shared      - Shared TypeScript types/enums (used by backend)
/PLAN.md     - Full technical plan (12 sections)
/prd.md      - Product requirements document
```

## Build, Lint, and Test Commands

### Backend (`/backend`)

```bash
npm run build        # Compile TypeScript
npm run lint         # ESLint with auto-fix
npm test             # Run Jest unit tests
npm run test:cov     # Tests with coverage
npm run test:e2e     # End-to-end tests
npm run start:dev    # Run with hot reload
npm run start        # Run compiled
```

### Shared (`/shared`)

```bash
npm run build        # Compile TypeScript types
npm run watch        # Watch mode
```

### Mobile (`/mobile`)

Requires Flutter SDK (installed at `~/development/flutter`).

```bash
export PATH="$HOME/development/flutter/bin:$PATH"
flutter analyze      # Static analysis
flutter test         # Run tests
flutter run          # Run on connected device/emulator
```

## Environment Variables (Backend)

Required (set in `.env` or environment):

```
# Transport APIs
DARWIN_API_KEY=         # National Rail Darwin API key (register at opendata.nationalrail.co.uk)
TFL_API_KEY=            # TfL Unified API key (register at api.tfl.gov.uk)
NETWORK_RAIL_TOKEN=     # Network Rail data feed token

# Push Notifications
FCM_PROJECT_ID=         # Firebase project ID
FCM_SERVICE_ACCOUNT=    # Path to Firebase service account JSON

# Database
DATABASE_URL=           # PostgreSQL connection string

# Redis
REDIS_URL=              # Redis connection string for BullMQ
```

## Key Design Decisions

- **Backend-driven notifications**: Mobile OS background tasks are unreliable for time-critical checks. The backend scheduler handles all transport checks and sends push notifications via FCM.
- **Privacy-first**: GPS coordinates never leave the device. Only station codes and abstract departure windows are synced to the backend.
- **Deterministic MVP**: Rules and heuristics (rolling weighted median, anti-spam rules), not ML.
- **Transport adapters**: Swappable adapter interface for Darwin, TfL, Network Rail, TransportAPI.
