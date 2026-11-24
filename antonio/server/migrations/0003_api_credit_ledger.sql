CREATE TABLE "api_credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_micros" bigint NOT NULL,
	"kind" text NOT NULL,
	"stripe_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_credit_ledger_kind_check" CHECK ("kind" IN ('purchase', 'usage'))
);
--> statement-breakpoint
ALTER TABLE "api_credit_ledger" ADD CONSTRAINT "api_credit_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "api_credit_stripe_session_unique" ON "api_credit_ledger" USING btree ("stripe_session_id");
--> statement-breakpoint
CREATE INDEX "api_credit_user_created" ON "api_credit_ledger" USING btree ("user_id", "created_at");
