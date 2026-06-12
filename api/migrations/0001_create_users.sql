-- Migration: 0001_create_users
-- Creates the users table for email+password authentication.
-- UUIDs are generated in application code (crypto.randomUUID) because
-- D1 does not have a built-in uuid() function.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
