# Testing and verification

## Automated checks

Run each command from the repository root:

```bash
(cd server && npm test)
(cd server && npm run build)
(cd client && npm run typecheck)
(cd client && npm run build)
```

Verification performed on 2026-11-19:

- Backend unit tests: **21 passed**
- Backend TypeScript build: **passed**
- Frontend TypeScript check: **passed**
- Frontend production build: **passed**

Running `npm test` from the repository root is not supported because the
repository has independent `server/` and `client/` packages.

## Help page verification

- **Offline screen:** no dedicated offline/no-internet screen exists. Network
  failures are converted to `NETWORK_ERROR` in `client/src/api.ts` and shown
  through the existing generic error banners.
- **Callback URL:** both callback URL values in the Help page use
  `/api/payments/mpesa/stk-callback` (not `/mpea/stk-callback`).
- **Current status:** the Help page claims Render with `rootDir: server`,
  M-Pesa `Sandbox`, the deployed Render callback URL, and the deployed Vercel
  frontend. These match the deployment facts used for verification.

## Scratch files

The following deployment/configuration notes are intentionally ignored by
`.gitignore` and are neither tracked nor reported as standard untracked files:

| File | Ignore rule | Git state |
|---|---|---|
| `error.txt` | `error.txt` | ignored, not tracked |
| `errorrender.txt` | `errorrender.txt` | ignored, not tracked |
| `server/test.txt` | `server/*.txt` | ignored, not tracked |
| `server/links.txt` | `server/*.txt` | ignored, not tracked |
| `server/daraja.txt` | `server/*.txt` | ignored, not tracked |
