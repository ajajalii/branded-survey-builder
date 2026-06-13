import { Hono } from "hono";
import { cors } from "hono/cors";
import authRouter from "./routes/auth";
import surveyRouter from "./routes/survey";
import type { Env } from "./types";

const app = new Hono<Env>();

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
