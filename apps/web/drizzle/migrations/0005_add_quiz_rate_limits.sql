CREATE TABLE IF NOT EXISTS "user_quiz_rate_limits" (
  "user_id" text PRIMARY KEY,
  "next_allowed_at" timestamp with time zone NOT NULL
);
