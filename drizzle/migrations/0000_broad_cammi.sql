CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"auth_provider" text,
	"provider_user_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "graph_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"type" text NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "graph_edges_source_target_type_key" UNIQUE("source","target","type")
);
--> statement-breakpoint
CREATE TABLE "graph_nodes" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"domain" text NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"type" text DEFAULT 'concept' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"explanation" text,
	"wiki_url" text,
	"domain" text,
	"level" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_card_states" (
	"user_id" uuid NOT NULL,
	"card_id" text NOT NULL,
	"status" text,
	"confidence" integer DEFAULT 0,
	"last_seen" timestamp with time zone DEFAULT now(),
	CONSTRAINT "user_card_states_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
CREATE TABLE "user_knowledge_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"topic" text DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_knowledge_states" (
	"user_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"knowledge_state" real DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"last_updated" timestamp with time zone DEFAULT now(),
	"first_known_at" timestamp with time zone,
	CONSTRAINT "user_knowledge_states_user_id_node_id_pk" PRIMARY KEY("user_id","node_id")
);
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_source_graph_nodes_id_fk" FOREIGN KEY ("source") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graph_edges" ADD CONSTRAINT "graph_edges_target_graph_nodes_id_fk" FOREIGN KEY ("target") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_card_states" ADD CONSTRAINT "user_card_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_card_states" ADD CONSTRAINT "user_card_states_card_id_knowledge_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."knowledge_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_knowledge_states" ADD CONSTRAINT "user_knowledge_states_node_id_graph_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auth_sessions_user_id" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_users_provider_identity" ON "auth_users" USING btree ("auth_provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "idx_graph_edges_source" ON "graph_edges" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_graph_edges_target" ON "graph_edges" USING btree ("target");--> statement-breakpoint
CREATE INDEX "idx_graph_edges_type" ON "graph_edges" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_domain" ON "graph_nodes" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_graph_nodes_level" ON "graph_nodes" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_knowledge_cards_domain" ON "knowledge_cards" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_user_card_states_user_id" ON "user_card_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_card_states_status" ON "user_card_states" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_user_knowledge_items_user" ON "user_knowledge_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_knowledge_states_user" ON "user_knowledge_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_knowledge_states_node" ON "user_knowledge_states" USING btree ("node_id");
