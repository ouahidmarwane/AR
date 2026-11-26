/**
 * Lectures côté serveur (Server Components) liées à la session.
 */
import { headers } from "next/headers";

import { auth } from "@/lib/auth/server";

import type { CurrentUser } from "./types";

/** Utilisateur connecté, ou null sans session valide (ne lève pas d'erreur). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, emailVerified } = session.user;
  return { id, name, email, emailVerified };
}
