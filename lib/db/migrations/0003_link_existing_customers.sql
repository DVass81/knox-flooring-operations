-- Create stable identities using explicit record links only. Names never merge customers.
INSERT INTO customers (id, name, email, phone, notes, created_at, updated_at)
SELECT 'legacy:job:' || id, customer_name, email, phone,
  'Imported from existing job ' || job_number,
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM jobs WHERE customer_id IS NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE jobs SET customer_id = 'legacy:job:' || id WHERE customer_id IS NULL;
--> statement-breakpoint
UPDATE invoices i SET customer_id = j.customer_id FROM jobs j
WHERE i.customer_id IS NULL AND i.job_id = j.id;
--> statement-breakpoint
UPDATE leads l SET customer_id = j.customer_id FROM jobs j
WHERE l.customer_id IS NULL AND l.converted_job_id = j.id;
--> statement-breakpoint
-- Contradictory proposal links are left separate for an explicit human merge.
UPDATE proposals p SET customer_id = j.customer_id FROM jobs j
WHERE p.customer_id IS NULL
  AND j.id = coalesce(p.converted_job_id, p.job_id)
  AND (p.job_id IS NULL OR p.converted_job_id IS NULL OR p.job_id = p.converted_job_id);
--> statement-breakpoint
INSERT INTO customers (id, name, email, phone, notes, created_at, updated_at)
SELECT 'legacy:lead:' || id, customer_name, email, phone, 'Imported from an existing lead',
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM leads WHERE customer_id IS NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE leads SET customer_id = 'legacy:lead:' || id WHERE customer_id IS NULL;
--> statement-breakpoint
INSERT INTO customers (id, name, notes, created_at, updated_at)
SELECT 'legacy:proposal:' || id, customer_name, 'Imported from an existing proposal; identity needs review',
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM proposals WHERE customer_id IS NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE proposals SET customer_id = 'legacy:proposal:' || id WHERE customer_id IS NULL;
--> statement-breakpoint
INSERT INTO customers (id, name, notes, created_at, updated_at)
SELECT 'legacy:invoice:' || id, customer_name, 'Imported from an existing invoice without a linked job',
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM invoices WHERE customer_id IS NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE invoices SET customer_id = 'legacy:invoice:' || id WHERE customer_id IS NULL;
--> statement-breakpoint
INSERT INTO customer_sites (id, customer_id, label, address, city, created_at, updated_at)
SELECT 'legacy:job-site:' || id, customer_id, 'Job ' || job_number, address, city,
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM jobs WHERE site_id IS NULL AND trim(address) <> ''
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE jobs SET site_id = 'legacy:job-site:' || id WHERE site_id IS NULL AND trim(address) <> '';
--> statement-breakpoint
UPDATE leads l SET site_id = j.site_id FROM jobs j
WHERE l.site_id IS NULL AND l.converted_job_id = j.id AND l.customer_id = j.customer_id
  AND trim(l.address) = trim(j.address) AND trim(l.city) = trim(j.city) AND j.site_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO customer_sites (id, customer_id, label, address, city, state, zip, created_at, updated_at)
SELECT 'legacy:lead-site:' || id, customer_id, 'Lead project', address, city, state, zip,
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM leads WHERE site_id IS NULL AND trim(address) <> ''
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
UPDATE leads SET site_id = 'legacy:lead-site:' || id WHERE site_id IS NULL AND trim(address) <> '';
--> statement-breakpoint
UPDATE proposals p SET site_id = j.site_id FROM jobs j
WHERE p.site_id IS NULL AND p.customer_id = j.customer_id
  AND j.id = coalesce(p.converted_job_id, p.job_id)
  AND (p.job_id IS NULL OR p.converted_job_id IS NULL OR p.job_id = p.converted_job_id);
