-- Preserve existing orphaned history; enforce all new references and parent deletion. No validation or data rewriting occurs.
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_job_id_jobs_id_fk" FOREIGN KEY ("converted_job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "job_materials" ADD CONSTRAINT "job_materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "labor_entries" ADD CONSTRAINT "labor_entries_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "material_usage" ADD CONSTRAINT "material_usage_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "materials" ADD CONSTRAINT "materials_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_converted_job_id_jobs_id_fk" FOREIGN KEY ("converted_job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crew_bookings" ADD CONSTRAINT "crew_bookings_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "estimate_drafts" ADD CONSTRAINT "estimate_drafts_converted_job_id_jobs_id_fk" FOREIGN KEY ("converted_job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "job_callbacks" ADD CONSTRAINT "job_callbacks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "job_photos_job_id_idx" ON "job_photos" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "leads_converted_job_id_idx" ON "leads" USING btree ("converted_job_id");--> statement-breakpoint
CREATE INDEX "job_materials_job_id_idx" ON "job_materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "labor_entries_job_id_idx" ON "labor_entries" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "material_usage_job_id_idx" ON "material_usage" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "materials_job_id_idx" ON "materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "proposals_job_id_idx" ON "proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "proposals_converted_job_id_idx" ON "proposals" USING btree ("converted_job_id");--> statement-breakpoint
CREATE INDEX "invoices_job_id_idx" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "measurements_job_id_idx" ON "measurements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "tasks_related_job_id_idx" ON "tasks" USING btree ("related_job_id");--> statement-breakpoint
CREATE INDEX "crew_bookings_job_id_idx" ON "crew_bookings" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "estimate_drafts_converted_job_id_idx" ON "estimate_drafts" USING btree ("converted_job_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_job_id_idx" ON "inventory_movements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_job_id_idx" ON "inventory_reservations" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_callbacks_job_id_idx" ON "job_callbacks" USING btree ("job_id");