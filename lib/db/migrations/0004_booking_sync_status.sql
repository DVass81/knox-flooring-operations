ALTER TABLE "crew_bookings" ADD COLUMN "calendar_sync_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "crew_bookings" ADD COLUMN "calendar_sync_error" text;