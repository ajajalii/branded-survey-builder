// src/types.ts
//
// Central type definitions for the Hono app.
//
// WHY A SEPARATE TYPES FILE?
// Hono uses generics to thread environment bindings and per-request variables
// through the entire app. Defining them once here avoids repeating the same
// generic arguments on every route handler and middleware.

export type Env = {
  // Cloudflare bindings (populated by the Workers runtime from wrangler.toml)
  Bindings: {
    DB: D1Database; // The D1 database bound as "DB"
    JWT_SECRET: string; // JWT signing secret from Wrangler secrets/vars
  };
  // Per-request variables set by middleware and readable in route handlers
  Variables: {
    userId: string;
    userEmail: string;
  };
};

// Shape of a row in the `users` table.
// Used for query results — keeps DB access type-safe without an ORM.
export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type SurveyRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  primary_color: string;
  logo_url: string | null;
  created_at: string;
};

export type QuestionRow = {
  id: string;
  survey_id: string;
  question_order: number;
  type: string;
  prompt: string;
  options: string | null;
  created_at: string;
};

export type ResponseRow = {
  id: string;
  survey_id: string;
  answers: string;
  created_at: string;
};
