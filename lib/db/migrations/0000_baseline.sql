CREATE TABLE IF NOT EXISTS "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_number" text NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"flooring_type" text NOT NULL,
	"rooms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope_of_work" text DEFAULT '' NOT NULL,
	"square_footage" real DEFAULT 0 NOT NULL,
	"crew_assigned" text DEFAULT 'Unassigned' NOT NULL,
	"salesperson_id" text,
	"est_start_date" text,
	"est_completion_date" text,
	"material_status" text NOT NULL,
	"labor_estimate" real DEFAULT 0 NOT NULL,
	"est_labor_hours" real DEFAULT 0 NOT NULL,
	"material_estimate" real DEFAULT 0 NOT NULL,
	"est_revenue" real DEFAULT 0 NOT NULL,
	"est_gross_profit" real DEFAULT 0 NOT NULL,
	"gross_margin_pct" real DEFAULT 0 NOT NULL,
	"actual_revenue" real DEFAULT 0 NOT NULL,
	"actual_labor_cost" real DEFAULT 0 NOT NULL,
	"actual_material_cost" real DEFAULT 0 NOT NULL,
	"actual_add_on_cost" real DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"priority_level" text NOT NULL,
	"risk_level" text NOT NULL,
	"status" text NOT NULL,
	"stage_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"share_token" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"stage" text NOT NULL,
	"object_path" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"flooring_interest" text NOT NULL,
	"estimated_value" real DEFAULT 0 NOT NULL,
	"source" text NOT NULL,
	"stage" text NOT NULL,
	"salesperson" text DEFAULT 'Unassigned' NOT NULL,
	"follow_up_date" text,
	"company" text DEFAULT '' NOT NULL,
	"contact_type" text DEFAULT '' NOT NULL,
	"branch" text DEFAULT '' NOT NULL,
	"main_phone" text DEFAULT '' NOT NULL,
	"spouse_phone" text DEFAULT '' NOT NULL,
	"cc_email" text DEFAULT '' NOT NULL,
	"desired_services" text DEFAULT '' NOT NULL,
	"estimated_sqft" real DEFAULT 0 NOT NULL,
	"interest_level" text DEFAULT '' NOT NULL,
	"install_request" text DEFAULT '' NOT NULL,
	"lead_cost" real DEFAULT 0 NOT NULL,
	"financing_amount" real DEFAULT 0 NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"address_title" text DEFAULT '' NOT NULL,
	"street" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"county" text DEFAULT '' NOT NULL,
	"subdivision" text DEFAULT '' NOT NULL,
	"sort_order" real DEFAULT 0 NOT NULL,
	"activity_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note_entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"samples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interactions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"measurements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"lost_reason" text,
	"converted_job_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "job_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"name" text NOT NULL,
	"quantity" real DEFAULT 0 NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "labor_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"date" text NOT NULL,
	"crew" text DEFAULT '' NOT NULL,
	"worker_type" text DEFAULT 'unmapped' NOT NULL,
	"worker_external_id" text,
	"hourly_cost" real DEFAULT 0 NOT NULL,
	"hours" real DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"accounting_status" text DEFAULT 'not_ready' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "material_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"material" text NOT NULL,
	"quantity" real DEFAULT 0 NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"vendor_name" text DEFAULT '' NOT NULL,
	"vendor_external_id" text,
	"expense_account_external_id" text,
	"transaction_date" text,
	"accounting_status" text DEFAULT 'not_ready' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "materials" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"job_number" text NOT NULL,
	"customer" text NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"flooring_type" text NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"ordered_date" text,
	"expected_delivery_date" text,
	"actual_delivery_date" text,
	"received" boolean DEFAULT false NOT NULL,
	"damaged" boolean DEFAULT false NOT NULL,
	"missing_items" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"sku" text DEFAULT '' NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"unit" text NOT NULL,
	"cost" real DEFAULT 0 NOT NULL,
	"price" real DEFAULT 0 NOT NULL,
	"quantity_on_hand" real DEFAULT 0 NOT NULL,
	"inventory_type" text DEFAULT 'Inventory' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"image_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text,
	"customer_name" text NOT NULL,
	"project_location" text DEFAULT '' NOT NULL,
	"flooring_type" text NOT NULL,
	"room_list" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"salesperson_id" text,
	"total_sq_ft" real DEFAULT 0 NOT NULL,
	"scope_of_work" text DEFAULT '' NOT NULL,
	"estimated_price" real DEFAULT 0 NOT NULL,
	"expected_timeline" text DEFAULT '' NOT NULL,
	"material_assumptions" text DEFAULT '' NOT NULL,
	"exclusions" text DEFAULT '' NOT NULL,
	"warranty_note" text DEFAULT '' NOT NULL,
	"deposit_type" text DEFAULT 'none' NOT NULL,
	"deposit_value" real DEFAULT 0 NOT NULL,
	"payment_terms" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"share_token" text DEFAULT '' NOT NULL,
	"sent_at" text,
	"viewed_at" text,
	"accepted_at" text,
	"declined_at" text,
	"signature" text DEFAULT '' NOT NULL,
	"converted_job_id" text,
	"converted_invoice_id" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salespeople" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"commission_rate" real,
	"color" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"job_id" text NOT NULL,
	"job_number" text DEFAULT '' NOT NULL,
	"customer_name" text NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subtotal" real DEFAULT 0 NOT NULL,
	"taxable_amount" real DEFAULT 0 NOT NULL,
	"tax_amount" real DEFAULT 0 NOT NULL,
	"discount_amount" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"deposit_amount" real DEFAULT 0 NOT NULL,
	"paid_amount" real DEFAULT 0 NOT NULL,
	"balance_amount" real DEFAULT 0 NOT NULL,
	"refunded_amount" real DEFAULT 0 NOT NULL,
	"tax_code" text DEFAULT '' NOT NULL,
	"payment_reference" text DEFAULT '' NOT NULL,
	"paid_at" text,
	"status" text NOT NULL,
	"issue_date" text DEFAULT '' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"owner_name" text DEFAULT '' NOT NULL,
	"owner_role" text DEFAULT '' NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"website" text DEFAULT '' NOT NULL,
	"default_waste_factor" real DEFAULT 0 NOT NULL,
	"default_labor_rate_lvp" real DEFAULT 0 NOT NULL,
	"default_labor_rate_hardwood" real DEFAULT 0 NOT NULL,
	"default_labor_rate_carpet" real DEFAULT 0 NOT NULL,
	"default_labor_rate_tile" real DEFAULT 0 NOT NULL,
	"commission_basis" text DEFAULT 'Gross Profit' NOT NULL,
	"default_commission_rate" real DEFAULT 5 NOT NULL,
	"lead_stages" jsonb DEFAULT '["New","Contacted","Estimate Scheduled","Quoted"]'::jsonb NOT NULL,
	"google_calendar_sync_token" text,
	"google_calendar_last_synced_at" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "communications" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"customer_key" text,
	"customer_name" text DEFAULT '' NOT NULL,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"to_address" text DEFAULT '' NOT NULL,
	"from_address" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"lead_id" text,
	"job_id" text,
	"external_id" text,
	"label" text NOT NULL,
	"rooms" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_sqft" real DEFAULT 0 NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"measured_date" text,
	"source" text DEFAULT 'Manual' NOT NULL,
	"sync_status" text DEFAULT 'local' NOT NULL,
	"sync_error" text,
	"last_synced_at" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"assignee_id" text,
	"start_at" text NOT NULL,
	"end_at" text NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"related_lead_id" text,
	"related_job_id" text,
	"google_event_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text DEFAULT 'system' NOT NULL,
	"entity_id" text,
	"ip_address" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" text NOT NULL,
	"used_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"csrf_token" text NOT NULL,
	"expires_at" text NOT NULL,
	"ip_address" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"preview_role" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text DEFAULT 'Owner' NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"last_login_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_accounting_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"mapping_type" text NOT NULL,
	"local_key" text NOT NULL,
	"quickbooks_id" text NOT NULL,
	"quickbooks_name" text DEFAULT '' NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_conflicts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"local_id" text NOT NULL,
	"quickbooks_id" text NOT NULL,
	"local_snapshot" jsonb NOT NULL,
	"quickbooks_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" text,
	"resolved_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"realm_id" text NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"environment" text DEFAULT 'sandbox' NOT NULL,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"access_token_expires_at" text NOT NULL,
	"refresh_token_expires_at" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"readiness_status" text DEFAULT 'reconciliation_required' NOT NULL,
	"last_sync_at" text,
	"last_cdc_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_entity_mappings" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"local_id" text NOT NULL,
	"quickbooks_id" text NOT NULL,
	"sync_token" text DEFAULT '0' NOT NULL,
	"fingerprint" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'linked' NOT NULL,
	"last_synced_at" text,
	"last_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_sync_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"local_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" text,
	"approved_by" text,
	"approved_at" text,
	"started_at" text,
	"completed_at" text,
	"last_error" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quickbooks_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"realm_id" text DEFAULT '' NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" text NOT NULL,
	"processed_at" text,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_request_audits" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"estimated_cost_micros" integer DEFAULT 0 NOT NULL,
	"approved_output" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demo_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"record_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demo_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'captured' NOT NULL,
	"external_delivery" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demo_record_origins" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"data_origin" text DEFAULT 'team' NOT NULL,
	"scenario_key" text,
	"baseline_version" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipient_allowlist" (
	"id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"channel" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tour_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_key" text NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"checkpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" text,
	"completed_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_audio_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"script_hash" text NOT NULL,
	"step_id" text NOT NULL,
	"manifest_version" text NOT NULL,
	"model" text NOT NULL,
	"voice" text NOT NULL,
	"content_type" text DEFAULT 'audio/mpeg' NOT NULL,
	"audio_base64" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"voice_enabled" boolean DEFAULT false NOT NULL,
	"captions_enabled" boolean DEFAULT true NOT NULL,
	"welcome_dismissed" boolean DEFAULT false NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "training_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_key" text NOT NULL,
	"manifest_version" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"voice_enabled" boolean DEFAULT false NOT NULL,
	"checkpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practice_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" text NOT NULL,
	"completed_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_token_hash_unique" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_hash_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_accounting_mapping_unique" ON "quickbooks_accounting_mappings" USING btree ("mapping_type","local_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_realm_unique" ON "quickbooks_connections" USING btree ("realm_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_local_mapping_unique" ON "quickbooks_entity_mappings" USING btree ("entity_type","local_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_sync_idempotency_unique" ON "quickbooks_sync_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_webhook_event_unique" ON "quickbooks_webhook_events" USING btree ("event_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "training_audio_cache_script_hash_idx" ON "training_audio_cache" USING btree ("script_hash");