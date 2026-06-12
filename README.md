# Branded Survey Builder

A small survey builder app that works like a simplified Typeform/Tally clone.
It includes a React frontend, a TypeScript backend running on Cloudflare
Workers, and a Cloudflare D1 database for stored data.

This README explains:
- what the app does,
- how the database is used,
- why Cloudflare and login are needed,
- what `pnpm` is,
- how to run the project locally.

---

## What this project does

This app supports:
- user signup and login,
- a backend API for authentication and survey data,
- storage of user accounts, surveys, questions, and responses,
- a browser UI that talks to the backend.

The current main feature is authentication, but the backend is already
structured to support surveys and responses too.

---

## Main pieces of the app

### Frontend (`web/`)

This is the part users interact with in the browser.
It is built with:
- React: for building the page components and forms,
- Vite: for fast local development,
- TypeScript: to catch code mistakes early,
- TanStack Router: to define routes and protect authenticated pages.

The frontend stores the login token in `localStorage` and sends it with
API requests so the backend can identify the logged-in user.

### Backend (`api/`)

The backend runs as a Cloudflare Worker.
It is built with:
- Hono: a small web framework for Workers,
- TypeScript: for safer backend code,
- Wrangler: Cloudflare’s CLI tool for running and deploying Workers.

The backend handles:
- signup and login requests,
- user session verification,
- survey data creation and listing,
- connecting to the D1 database.

### Database (`Cloudflare D1`)

Cloudflare D1 is used as the database.
It behaves like SQLite, but it is hosted and managed by Cloudflare for use in
Workers.

The database stores:
- `users`: user accounts,
- `surveys`: survey metadata,
- `questions`: survey questions,
- `responses`: survey answers.

The database schema is defined in `migrations/0001_create_users.sql` and
`migrations/0002_create_surveys.sql`.

---

## How login works

### Why login is needed

Login proves that the browser belongs to a specific user.
Protected backend requests only work when the browser sends a valid token.
Without login, protected data is blocked.

### Signup flow

1. The user enters email and password in the browser.
2. The browser sends `POST /api/auth/signup`.
3. The backend validates the data and hashes the password.
4. The backend saves the user in the D1 database.
5. The backend returns a success response.

### Login flow

1. The user enters email and password.
2. The browser sends `POST /api/auth/login`.
3. The backend looks up the user in the D1 database.
4. The backend verifies the password using the stored password hash.
5. If successful, the backend returns a JWT token.
6. The browser stores the token and sends it with future requests.

### Protected requests

- The browser sends the token in the `Authorization: Bearer ...` header.
- The backend checks the token before allowing access.
- If the token is missing or invalid, the backend rejects the request.

This keeps user-specific data secure.

---

## Why Cloudflare is used

### Cloudflare Workers

Cloudflare Workers allow the backend to run without managing a server.
The code is deployed to Cloudflare’s edge network, which makes it fast and
scalable.

### Cloudflare D1

D1 is the database storage service for Workers.
It stores app data and is accessible from the backend with a simple query API.
It is easy to use with SQL syntax, and it works well in the Worker environment.

### Why log in to Cloudflare

Cloudflare login is needed when you use Wrangler to manage resources.
For example:
- creating a D1 database,
- deploying the Worker,
- setting production secrets.

If you only run locally with the existing local config, you do not need to log
in every time. But to create or deploy Cloudflare resources, Wrangler needs
Cloudflare access.

---

## What is `pnpm`?

`pnpm` is the package manager for this project.
It installs JavaScript dependencies like libraries and tools.

Why this project uses `pnpm`:
- It is fast,
- It stores packages in a shared cache,
- It avoids duplicate copies of the same dependency.

This repo is a **monorepo**, which means it contains more than one package in
one project:
- `api/` for the backend,
- `web/` for the frontend.

The root `package.json` defines workspace scripts so you can run both packages
with one command.

---

## How the database runs locally

When running locally, the backend is still a Worker, but it uses a local
simulation of D1.

That means:
- the backend runs like it would in Cloudflare,
- the database is stored locally,
- you can develop without deploying to Cloudflare.

This is controlled by `wrangler dev` and the local worker configuration.

---

## How to run the project

### Install dependencies

From the repo root:

```bash
pnpm install
```

### Run everything locally

From the repo root:

```bash
pnpm dev
```

This starts:
- the frontend on `http://localhost:5173`,
- the backend on `http://127.0.0.1:8787`.

### Run only the backend

```bash
cd api && pnpm dev
```

### Run only the frontend

```bash
cd web && pnpm dev
```

The frontend is configured to proxy `/api/*` requests to the backend, so the
browser can communicate with the API without extra configuration.

---

## Cloudflare setup notes

If you want a real Cloudflare D1 database, use these commands:

```bash
cd api
wrangler d1 create branded-survey-db
wrangler secret put JWT_SECRET
```

Then put the database ID into `api/wrangler.toml`.

For local development, keep `JWT_SECRET` in `api/.dev.vars`.

---

## Useful commands

```bash
pnpm dev
pnpm check
pnpm typecheck
cd api && pnpm dev
cd web && pnpm dev
```

If you want, I can also expand this README with a short quickstart section,
a diagram of the data flow, or a simpler “what happens when you login”
explanation.
