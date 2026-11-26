/**
 * Accès base du module organizations (membres et invitations).
 * Chaque fonction prend un TenantContext et applique tenantWhere() : un id de membre ou
 * d'invitation d'une autre organisation est "introuvable" (voir docs/security.md).
 * Les écritures passent par Better Auth (auth.api.*) dans actions.ts, après ces contrôles.
 */
import { and, asc, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { invitation, member, user } from "@/lib/db/schema";
import { memberRole, tenantWhere, type Role, type TenantContext } from "@/lib/db/tenant";
import { NotFoundError } from "@/lib/errors";

export type OrganizationMember = {
  memberId: string;
  userId: string;
  name: string;
  email: string;
  /** null si le rôle stocké est hors liste (aucun droit, voir requireTenant). */
  role: Role | null;
  joinedAt: Date;
};

export type PendingInvitation = {
  invitationId: string;
  email: string;
  role: Role | null;
  expiresAt: Date;
  createdAt: Date;
};

/** Membres de l'organisation du contexte, triés par nom. */
export async function listMembers(ctx: TenantContext): Promise<OrganizationMember[]> {
  const rows = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(tenantWhere(member, ctx))
    .orderBy(asc(user.name));

  return rows.map((row) => ({ ...row, role: memberRole(row.role) }));
}

/** Un membre de l'organisation du contexte. @throws NotFoundError (y compris autre organisation). */
export async function getMember(ctx: TenantContext, memberId: string): Promise<OrganizationMember> {
  const rows = await db
    .select({
      memberId: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      joinedAt: member.createdAt,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(and(tenantWhere(member, ctx), eq(member.id, memberId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("Membre introuvable");
  return { ...row, role: memberRole(row.role) };
}

/** Nombre d'owners de l'organisation du contexte. */
export async function countOwners(ctx: TenantContext): Promise<number> {
  const rows = await db.select({ role: member.role }).from(member).where(tenantWhere(member, ctx));
  return rows.filter((row) => memberRole(row.role) === "owner").length;
}

/** Invitations en attente et non expirées de l'organisation du contexte. */
export async function listPendingInvitations(ctx: TenantContext): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(
      and(
        tenantWhere(invitation, ctx),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitation.createdAt));

  return rows.map((row) => ({ ...row, role: memberRole(row.role ?? "") }));
}

/** Une invitation de l'organisation du contexte. @throws NotFoundError (y compris autre organisation). */
export async function getInvitation(
  ctx: TenantContext,
  invitationId: string,
): Promise<PendingInvitation & { status: string }> {
  const rows = await db
    .select({
      invitationId: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    })
    .from(invitation)
    .where(and(tenantWhere(invitation, ctx), eq(invitation.id, invitationId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new NotFoundError("Invitation introuvable");
  return { ...row, role: memberRole(row.role ?? "") };
}
