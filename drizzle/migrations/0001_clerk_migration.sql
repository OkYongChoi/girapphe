-- Migration: Switch from custom auth to Clerk
-- 1. Drop FK from user_card_states to users (if exists)
ALTER TABLE "user_card_states" DROP CONSTRAINT IF EXISTS "user_card_states_user_id_users_id_fk";

-- 2. Change user_id columns from uuid to text (Clerk IDs are like user_2abc123)
ALTER TABLE "user_card_states" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "user_knowledge_states" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

-- 3. Drop Clerk-managed auth tables (Clerk handles auth now)
DROP TABLE IF EXISTS "auth_sessions";
DROP TABLE IF EXISTS "auth_users";

-- 4. Drop legacy users bridge table
DROP TABLE IF EXISTS "users";
