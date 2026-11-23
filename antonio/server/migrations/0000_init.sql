CREATE TABLE "action_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"actor" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid,
	"kind" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"idempotency_key" text NOT NULL,
	"origin" text NOT NULL,
	"origin_ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rule_id" uuid,
	"params" jsonb NOT NULL,
	"params_hash" text NOT NULL,
	"summary" text NOT NULL,
	"reason" text,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_result" jsonb,
	"reversibility" text DEFAULT 'irreversible' NOT NULL,
	"revert_info" jsonb,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"presented_at" timestamp with time zone,
	"briefed_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"params_hash" text NOT NULL,
	"decision" text NOT NULL,
	"channel" text NOT NULL,
	"utterance" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"user_id" uuid,
	"type" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autonomy" (
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"level" text DEFAULT 'prepare' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "autonomy_user_id_category_pk" PRIMARY KEY("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"for_date" date NOT NULL,
	"trigger" text DEFAULT 'scheduled' NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"viewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"scope_type" text NOT NULL,
	"scope_id" uuid NOT NULL,
	"monthly_limit_micros" bigint DEFAULT 20000000 NOT NULL,
	"voice_minutes_daily" integer DEFAULT 60 NOT NULL,
	"voice_session_max_minutes" integer DEFAULT 15 NOT NULL,
	"actions_daily" integer DEFAULT 100 NOT NULL,
	"agent_steps_per_turn" integer DEFAULT 8 NOT NULL,
	"alert_threshold_pct" integer DEFAULT 80 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_scope_type_scope_id_pk" PRIMARY KEY("scope_type","scope_id")
);
--> statement-breakpoint
CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"account_email" text NOT NULL,
	"provider_account_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"granted_scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"sync_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"webhook_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" text DEFAULT 'chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_mailbox" (
	"message_id" uuid PRIMARY KEY NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_event_id" text NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"title" text DEFAULT '(sans titre)' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"timezone" text,
	"location" text,
	"online_meeting_url" text,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"organizer_email" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"show_as" text DEFAULT 'busy' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text NOT NULL,
	"scope" text,
	"status" text DEFAULT 'proposed' NOT NULL,
	"source" text DEFAULT 'conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_message_id" text NOT NULL,
	"provider_thread_id" text NOT NULL,
	"internet_message_id" text,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"snippet" text DEFAULT '' NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"in_trash" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"is_sent" boolean DEFAULT false NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"folder_id" text,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"category_reason" text,
	"category_source" text DEFAULT 'heuristic' NOT NULL,
	"needs_action" boolean DEFAULT false NOT NULL,
	"extracted" jsonb,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"state" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"capabilities" jsonb NOT NULL,
	"code_verifier" text NOT NULL,
	"connection_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"first_name" text,
	"activity" text,
	"company" text,
	"job_role" text,
	"profession_preset" text DEFAULT 'generalist' NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"work_days" jsonb DEFAULT '[1,2,3,4,5]'::jsonb NOT NULL,
	"work_start" text DEFAULT '09:00' NOT NULL,
	"work_end" text DEFAULT '18:00' NOT NULL,
	"repetitive_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"priorities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone" text DEFAULT 'cordial et concis' NOT NULL,
	"tutoiement" boolean DEFAULT false NOT NULL,
	"signature" text,
	"priority_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meeting_prefs" jsonb DEFAULT '{"defaultDurationMin":30,"bufferMin":15,"preferredMode":"visio"}'::jsonb NOT NULL,
	"briefing_time" text DEFAULT '08:30' NOT NULL,
	"briefing_content" jsonb DEFAULT '{"messages":true,"actions":true,"approvals":true,"agenda":true,"priorities":true,"errors":true}'::jsonb NOT NULL,
	"briefing_auto_speak" boolean DEFAULT false NOT NULL,
	"assistant_name" text DEFAULT 'Antonio' NOT NULL,
	"assistant_voice" text DEFAULT 'sillage' NOT NULL,
	"wake_word_enabled" boolean DEFAULT false NOT NULL,
	"transcript_retention_days" integer DEFAULT 30 NOT NULL,
	"audio_recording" boolean DEFAULT false NOT NULL,
	"onboarding_step" text,
	"onboarding_completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"trigger" text DEFAULT 'new_message' NOT NULL,
	"conditions" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"exceptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_description" text NOT NULL,
	"examples_allowed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"examples_need_approval" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"daily_limit" integer DEFAULT 20 NOT NULL,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text DEFAULT 'user' NOT NULL,
	"source_message_id" uuid,
	"action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"channel" text DEFAULT 'chat' NOT NULL,
	"content" text NOT NULL,
	"ui_events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_trace" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"model" text,
	"quantity" bigint NOT NULL,
	"unit" text NOT NULL,
	"cost_micros" bigint DEFAULT 0 NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_session_id" text,
	"conversation_id" uuid,
	"status" text DEFAULT 'starting' NOT NULL,
	"reported_seconds" integer DEFAULT 0 NOT NULL,
	"close_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_receipts" (
	"dedupe_key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action_events" ADD CONSTRAINT "action_events_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autonomy" ADD CONSTRAINT "autonomy_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_mailbox" ADD CONSTRAINT "demo_mailbox_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_connection_id_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "turns" ADD CONSTRAINT "turns_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_events_action" ON "action_events" USING btree ("action_id");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_user_idem" ON "actions" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "actions_user_status" ON "actions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "actions_user_created" ON "actions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_user_idx" ON "audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "briefings_user_idx" ON "briefings" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_user_provider_account" ON "connections" USING btree ("user_id","provider","account_email");--> statement-breakpoint
CREATE INDEX "connections_user_idx" ON "connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_conn_provider_id" ON "events" USING btree ("connection_id","provider_event_id");--> statement-breakpoint
CREATE INDEX "events_user_start" ON "events" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "memories_user_idx" ON "memories" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_conn_provider_id" ON "messages" USING btree ("connection_id","provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_user_received" ON "messages" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "messages_thread" ON "messages" USING btree ("connection_id","provider_thread_id");--> statement-breakpoint
CREATE INDEX "rules_user_idx" ON "rules" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "turns_conv_idx" ON "turns" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_org_created" ON "usage_records" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "usage_user_created" ON "usage_records" USING btree ("user_id","created_at");