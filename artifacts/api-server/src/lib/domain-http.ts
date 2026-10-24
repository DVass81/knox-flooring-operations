import type { Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { DomainError } from "./operations-rules";

export const revision = z.number().int().positive();
export const finiteNonnegative = z.number().finite().nonnegative();
export const optionalId = z.string().trim().min(1).nullable().optional();
export const record = z.record(z.string(), z.unknown());
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new DomainError(
      400,
      "Please correct the highlighted fields.",
      result.error.flatten(),
    );
  return result.data;
}
export function domainRoute(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      if (error instanceof DomainError) {
        res
          .status(error.status)
          .json({ error: error.message, details: error.details });
        return;
      }
      const databaseCode =
        (error as { code?: string; cause?: { code?: string } })?.cause?.code ??
        (error as { code?: string })?.code;
      if (databaseCode === "40P01" || databaseCode === "40001") {
        res.status(409).json({
          error:
            "Another change occurred at the same time. Refresh this record and retry; this attempt was rolled back.",
        });
        return;
      }
      if (databaseCode === "23503" || databaseCode === "23001") {
        res.status(409).json({
          error:
            "A related record changed or still depends on this record. Refresh its links and keep existing history before retrying.",
        });
        return;
      }
      if (databaseCode === "23505") {
        res
          .status(409)
          .json({
            error:
              "This identifier or request key is already in use. Review the existing record before retrying.",
          });
        return;
      }
      req.log.error({ err: error }, "Domain request failed");
      res.status(500).json({
        error:
          "The change could not be completed. Your saved records have been preserved.",
      });
    }
  };
}
export function id(req: Request) {
  return String(req.params.id);
}
