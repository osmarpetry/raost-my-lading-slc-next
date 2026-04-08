# slc-next

Single-page landing checker built from `yan-template-next-2026`.

## Scope

- one page at `/`
- `POST /api/scans`
- `GET /api/scans/:scanId`
- Socket.IO scan progress streaming
- in-memory scan persistence for refresh/reconnect recovery
- no auth, billing, account, or checkout flows

## Scripts

- `pnpm dev`
- `pnpm build`
- `pnpm start`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm test:api`
- `pnpm test:e2e`
- `pnpm test:storybook`
- `pnpm test`
- `pnpm storybook`
- `pnpm build-storybook`
- `pnpm generate:component`
- `pnpm generate:server-module`
- `pnpm generate:feature`

## Runtime Notes

- `server.ts` boots Next and attaches Socket.IO.
- The scan pipeline validates the URL, crawls a small bounded slice, emits live terminal events, and persists snapshots in memory.
- Polling fallback stays active during a run even when the websocket is available.
