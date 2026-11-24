CREATE TABLE "ai_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"amount_usd" real NOT NULL,
	"paid_amount" real,
	"paid_currency" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credits_external_idx" ON "ai_credits" USING btree ("external_id");