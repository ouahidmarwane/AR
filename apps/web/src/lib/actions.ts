import { z } from "zod";

import { AppError } from "@/lib/errors";

/**
 * Résultat standard d'une server action, sérialisable vers le client.
 * Les erreurs attendues sont des codes stables (à traduire côté front), jamais des messages
 * techniques. Les erreurs inattendues sont relancées (error boundary de Next.js).
 */
export type ActionResult<T = void, E extends string = string> =
  { ok: true; data: T } | { ok: false; error: E; fieldErrors?: Record<string, string[]> };

/** Codes communs à toutes les actions. */
export type CommonActionError =
  "INVALID_INPUT" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED";

export function ok(): ActionResult<void, never>;
export function ok<T>(data: T): ActionResult<T, never>;
export function ok<T>(data?: T): ActionResult<T | undefined, never> {
  return { ok: true, data };
}

export function fail<E extends string>(
  error: E,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never, E> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

/** Erreur de validation Zod -> INVALID_INPUT avec le détail par champ. */
export function invalidInput(error: z.ZodError): ActionResult<never, "INVALID_INPUT"> {
  const flattened = z.flattenError(error) as { fieldErrors: Record<string, string[] | undefined> };
  const fieldErrors = Object.fromEntries(
    Object.entries(flattened.fieldErrors).filter((entry): entry is [string, string[]] =>
      Array.isArray(entry[1]),
    ),
  );
  return fail("INVALID_INPUT", fieldErrors);
}

/** Convertit les erreurs de requireTenant()/repositories (401, 403, 404) en codes d'action. */
export function appErrorCode(error: unknown): "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | null {
  if (!(error instanceof AppError)) return null;
  if (error.status === 401) return "UNAUTHENTICATED";
  if (error.status === 403) return "FORBIDDEN";
  if (error.status === 404) return "NOT_FOUND";
  return null;
}

/** Code d'une erreur Better Auth (APIError), ex. "USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION". */
export function betterAuthErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("body" in error)) return null;
  const body = (error as { body?: { code?: unknown } }).body;
  return typeof body?.code === "string" ? body.code : null;
}
