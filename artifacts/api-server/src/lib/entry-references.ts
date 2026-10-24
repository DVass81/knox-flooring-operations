import { and, eq } from "drizzle-orm";
import {
  db,
  crewsTable,
  crewBookingsTable,
  jobCallbacksTable,
  productsTable,
} from "@workspace/db";
import { DomainError } from "./operations-rules";

export async function validateCallback(
  jobId: string,
  callbackId?: string | null,
) {
  if (!callbackId) return;
  const [callback] = await db
    .select()
    .from(jobCallbacksTable)
    .where(
      and(
        eq(jobCallbacksTable.id, callbackId),
        eq(jobCallbacksTable.jobId, jobId),
      ),
    );
  if (!callback)
    throw new DomainError(400, "The callback must belong to this job.");
}
export async function validateLaborReferences(
  jobId: string,
  data: {
    crewId?: string | null;
    bookingId?: string | null;
    callbackId?: string | null;
  },
  role: string,
) {
  await validateCallback(jobId, data.callbackId);
  if (data.crewId) {
    const [crew] = await db
      .select()
      .from(crewsTable)
      .where(eq(crewsTable.id, data.crewId));
    if (!crew) throw new DomainError(400, "Crew not found.");
    if (
      role === "installer" &&
      !(
        await db
          .select()
          .from(crewBookingsTable)
          .where(
            and(
              eq(crewBookingsTable.jobId, jobId),
              eq(crewBookingsTable.crewId, data.crewId),
            ),
          )
      ).length
    )
      throw new DomainError(403, "Choose a crew assigned to this job.");
  }
  if (data.bookingId) {
    const [booking] = await db
      .select()
      .from(crewBookingsTable)
      .where(eq(crewBookingsTable.id, data.bookingId));
    if (!booking || booking.jobId !== jobId || booking.crewId !== data.crewId)
      throw new DomainError(400, "Booking must belong to this job and crew.");
  }
}
export async function validateUsageReferences(
  jobId: string,
  data: { productId?: string | null; callbackId?: string | null },
) {
  await validateCallback(jobId, data.callbackId);
  if (data.productId) {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, data.productId));
    if (!product) throw new DomainError(400, "Product not found.");
    if (product.inventoryType === "Inventory")
      throw new DomainError(
        409,
        "Consume this product through Inventory or a job reservation. Stock usage will be recorded automatically.",
      );
  }
}
