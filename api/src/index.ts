// src/index.ts
//
// The Worker entrypoint. Wrangler looks for a default export with a `fetch`
// handler. Hono provides this via `app.fetch`.

import { Hono } from "hono";
import { cors } from "hono/cors";
import authRouter from "./routes/auth";
import surveyRouter from "./routes/survey";
import type { Env } from "./types";

const app = new Hono<Env>();

// ─── CORS ──────────────────────────────────────────────────────────────────────
// WHY CORS HERE?
// The frontend runs on a different origin (localhost:5173 in dev, separate
// domain in prod). Without CORS headers the browser will block API responses.
// In production you'd restrict `origin` to your frontend domain instead of "*".
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  })
);

// ─── Routes ────────────────────────────────────────────────────────────────────
app.route("/api/auth", authRouter);
app.route("/api/survey", surveyRouter);
// Health check — useful for verifying the Worker is deployed
app.get("/api/health", (c) => c.json({ ok: true }));

// Catch-all 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
