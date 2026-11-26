/**
 * Lectures côté serveur (Server Components) : requireTenant() puis repository.
 */
import { listUserMemberships, requireSession, requireTenant } from "@/lib/db/tenant";

import { listMembers, listPendingInvitations } from "./repository";

/** Organisations de l'utilisateur connecté (sélecteur d'organisation). @throws 401 */
export async function getMyOrganizations() {
  const user = await requireSession();
  return listUserMemberships(user.userId);
}

/** Membres de l'organisation de l'URL, pour tout membre. @throws 401/403 */
export async function getOrganizationMembers(orgSlug: string) {
  const ctx = await requireTenant(orgSlug);
  return listMembers(ctx);
}

/** Invitations en attente de l'organisation de l'URL (owner ou manager). @throws 401/403 */
export async function getPendingInvitations(orgSlug: string) {
  const ctx = await requireTenant(orgSlug, "manager");
  return listPendingInvitations(ctx);
}

/** Contexte de l'utilisateur dans l'organisation de l'URL (rôle pour adapter l'UI). @throws 401/403 */
export async function getMyRole(orgSlug: string) {
  const ctx = await requireTenant(orgSlug);
  return ctx.role;
}
