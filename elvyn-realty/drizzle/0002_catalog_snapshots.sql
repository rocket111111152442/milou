CREATE TABLE "catalog_snapshots" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"stored_at" timestamp with time zone NOT NULL
);
