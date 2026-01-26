# CallAgent

Lumentra voice agent platform with a real-time operations dashboard and a
production backend API.

## Repository layout

- `lumentra-dashboard/` - Next.js dashboard UI.
- `lumentra-api/` - Node.js/TypeScript API and voice stack services.
- `docs/` - product docs and pitch materials.
- `app/`, `components/`, `context/`, `types/` - UI assets kept at repo root.

## Prerequisites

- Node.js >= 20
- npm (or your preferred Node package manager)

## Quick start

Run the API and dashboard in separate terminals.

Backend:

```bash
cd lumentra-api
cp .env.example .env
npm install
npm run dev
```

Frontend:

```bash
cd lumentra-dashboard
npm install
npm run dev
```

Open http://localhost:3000.

## Production builds

Backend:

```bash
cd lumentra-api
npm run build
npm run start
```

Frontend:

```bash
cd lumentra-dashboard 
npm run build
npm run start
```

## Git hooks

This repo includes a pre-commit hook that formats staged files with Prettier.
Enable it after cloning:

```bash
git config core.hooksPath .githooks
```
