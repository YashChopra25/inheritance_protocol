This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment

Every variable is documented, with placeholder values, in
[`.env.example`](./.env.example). Copy it to `.env` and fill it in.

| Variable | Required | Purpose |
|---|---|---|
| `SESSION_SECRET` | yes | HMAC key for sign-in challenges and session cookies (≥ 32 chars) |
| `PINATA_JWT_TOKEN` | yes | Pinata credentials, server-side only |
| `PINATA_GATEWAY` | yes | Private gateway used to fetch sealed documents |
| `NEXT_PUBLIC_PROGRAM_ID` | yes | Deployed program address; the app refuses to start without it |
| `NEXT_PUBLIC_SOLANA_CLUSTER` / `NEXT_PUBLIC_RPC_ENDPOINT` | yes | Must agree with each other (checked at startup). The endpoint ships to the browser — no API keys |
| `APP_ORIGIN` | recommended | Canonical origin (e.g. `https://vault.example.com`) bound into every sign-in message as the SIWS domain/URI. Unset: the request's Host is used |
| `SOLANA_RPC_URL` | recommended | Server-only RPC for authorization lookups; use a private endpoint. Falls back to `NEXT_PUBLIC_RPC_ENDPOINT` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | recommended | Shared store for rate limits, upload quotas, burned sign-in nonces and revoked sessions |
| `TRUST_PROXY_HEADERS` | no | Set to `true` only behind a reverse proxy that overwrites `X-Forwarded-*`; enables per-IP rate limits and forwarded-host sign-in origins |
| `MAX_UPLOAD_BYTES_GLOBAL_PER_HOUR` | no | Upload budget across all wallets, in bytes (default 2 GB) |

Without Upstash configured, rate limits, upload quotas, burned sign-in nonces
and session revocations are held in process memory: they reset on restart and
are not shared between instances, and production logs a warning saying so.
With it, each check is an atomic Redis operation, and sign-in fails closed if
the store is unreachable.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
