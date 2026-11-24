CREATE TABLE "manual_listing_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"mime" text NOT NULL,
	"data_b64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text,
	"published" boolean DEFAULT false NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"operation" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category_id" integer,
	"category_name" text,
	"category_name_en" text,
	"province" text,
	"city" text,
	"sector" text,
	"price" double precision,
	"currency" text DEFAULT 'USD' NOT NULL,
	"bedrooms" integer,
	"bathrooms" real,
	"parking" integer,
	"area" real,
	"land_area" real,
	"furnished" boolean,
	"condition" text,
	"amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"video_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_listing_images" ADD CONSTRAINT "manual_listing_images_listing_id_manual_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."manual_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_listing_images_listing_idx" ON "manual_listing_images" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "manual_listings_slug_idx" ON "manual_listings" USING btree ("slug");