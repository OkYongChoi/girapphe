CREATE INDEX IF NOT EXISTS "idx_mcp_request_rate_limits_stale_token_creations"
  ON "mcp_request_rate_limits" ("window_started_at", "scope_key")
  WHERE "scope_key" LIKE 'token-creation:%';
