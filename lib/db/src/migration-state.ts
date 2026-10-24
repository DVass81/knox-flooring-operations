/** Keep in sync with the immutable SQL migrations; the database test verifies this list. */
export const schemaMigrationIds = ["0000_baseline", "0001_catalyst_operations", "0002_booking_links", "0003_link_existing_customers", "0004_booking_sync_status", "0005_callback_cost_links", "0006_job_history_guards"] as const;

export async function assertMigrationsApplied(client: { query: (text: string) => Promise<{ rows: Array<{ id: string }> }> }) {
  const { rows } = await client.query("SELECT id FROM public.catalyst_schema_migrations ORDER BY id");
  if (rows.length !== schemaMigrationIds.length || rows.some((row, index) => row.id !== schemaMigrationIds[index])) {
    throw new Error("The database migration version does not match this application release.");
  }
}
