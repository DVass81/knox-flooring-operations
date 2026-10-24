ALTER TABLE "tasks" ADD COLUMN "booking_id" text;--> statement-breakpoint
ALTER TABLE "crew_bookings" ADD COLUMN "task_id" text;