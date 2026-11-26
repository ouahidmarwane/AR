import { and, asc, eq, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import { headers } from "next/headers";

import { auth } from "@/lib/auth/server";
import { ORG_ROLES, type OrgRole } from "@/lib/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

import { db } from "./client";
import { member, organization, user } from "./schema";

/**
 * COUCHE D'ISOLATION MULTI-TENANT — voir docs/security.md.
 *
 * La base MySQL n'a pas de RLS : l'isolation entre organisations est garantie ICI.
 * Règles :
 *  1. Le TenantContext ne se construit QUE via requireTenant() (ou resolveTenant() côté
 *     serveur de confiance) : l'organizationId vient de la session + table member,
 *     jamais d'un paramètre envoyé par le client.
 *  2. Toute requête sur une table métier passe par un repository qui applique tenantWhere().
 *  3. Toute ligne lue par un autre chemin (jointure, id reçu du client...) est vérifiée
 *     avec assertSameTenant().
 */

export type Role = OrgRole;

export type TenantContext = Readonly<{
  organizationId: string;
  userId: string;
  role: Role;
}>;

/** Hiérarchie des rôles : un rôle inclut les droits des rôles inférieurs. */
const ROLE_RANK: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

function isRole(value: string): value is Role {
  return (ORG_ROLES as readonly string[]).includes(value);
}

/**
 * Better Auth stocke parfois plusieurs rôles séparés par des virgules ("manager,staff").
 * On retient le plus élevé ; un rôle inconnu ne donne aucun droit (fail closed).
 */
export function memberRole(rawRole: string): Role | null {
  const known = rawRole
    .split(",")
    .map((role) => role.trim())
    .filter(isRole);
  if (known.length === 0) return null;
  return known.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}

/**
 * Construit le contexte tenant d'un utilisateur DÉJÀ authentifié pour une organisation.
 * Lève ForbiddenError si l'utilisateur n'est pas membre ou si son rôle est insuffisant.
 * Ne jamais appeler avec un userId venant du client : utiliser requireTenant().
 */
export async function resolveTenant(
  userId: string,
  orgSlug: string,
  minRole: Role = "staff",
): Promise<TenantContext> {
  const rows = await db
    .select({ organizationId: organization.id, role: member.role })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(and(eq(organization.slug, orgSlug), eq(member.userId, userId)))
    .limit(1);

  const membership = rows[0];
  // Même erreur que l'organisation existe ou non : on ne révèle pas son existence.
  if (!membership) throw new ForbiddenError();

  const role = memberRole(membership.role);
  if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new ForbiddenError("Rôle insuffisant");
  }

  return Object.freeze({ organizationId: membership.organizationId, userId, role });
}

export type SessionUser = Readonly<{
  userId: string;
  email: string;
  name: string;
  emailVerified: boolean;
}>;

/**
 * Utilisateur connecté (session Better Auth de la requête courante), sans contexte
 * d'organisation. Pour tout ce qui concerne une organisation, utiliser requireTenant().
 * @throws UnauthenticatedError (401) sans session valide.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new UnauthenticatedError();
  const { id, email, name, emailVerified } = session.user;
  return Object.freeze({ userId: id, email, name, emailVerified });
}

async function getSessionUserId(): Promise<string> {
  return (await requireSession()).userId;
}

export type Membership = Readonly<{
  organizationId: string;
  slug: string;
  name: string;
  role: Role;
}>;

/**
 * Organisations dont un utilisateur DÉJÀ authentifié est membre (rôles hors liste ignorés).
 * Le userId doit venir de requireSession(), jamais du client.
 */
export async function listUserMemberships(userId: string): Promise<Membership[]> {
  const rows = await db
    .select({
      organizationId: organization.id,
      slug: organization.slug,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userId))
    .orderBy(asc(organization.name));

  return rows.flatMap((row) => {
    const role = memberRole(row.role);
    return role ? [{ ...row, role }] : [];
  });
}

/**
 * Point d'entrée OBLIGATOIRE de toute action/query d'un espace organisation.
 * @param orgSlug slug de l'organisation présent dans l'URL (/[locale]/app/[org]) :
 *                il sert seulement à CHOISIR l'organisation, l'appartenance est vérifiée en base.
 * @param minRole rôle minimum requis (défaut : staff).
 */
export async function requireTenant(orgSlug: string, minRole?: Role): Promise<TenantContext> {
  const userId = await getSessionUserId();
  return resolveTenant(userId, orgSlug, minRole);
}

/**
 * Condition Drizzle limitant une requête à l'organisation du contexte.
 * À combiner (and(...)) dans TOUTES les requêtes d'un repository sur une table métier.
 */
export function tenantWhere(table: { organizationId: MySqlColumn }, ctx: TenantContext): SQL {
  return eq(table.organizationId, ctx.organizationId);
}

/** Vérifie qu'une ligne lue appartient à l'organisation du contexte (défense en profondeur). */
export function assertSameTenant<T extends { organizationId: string }>(
  row: T | null | undefined,
  ctx: TenantContext,
): asserts row is T {
  if (!row || row.organizationId !== ctx.organizationId) {
    throw new ForbiddenError("Ressource d'une autre organisation");
  }
}

/** Accès au back-office : session valide ET user.is_super_admin = true (relu en base). */
export async function requireSuperAdmin(): Promise<{ userId: string }> {
  const userId = await getSessionUserId();
  const rows = await db
    .select({ isSuperAdmin: user.isSuperAdmin })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (rows[0]?.isSuperAdmin !== true) throw new ForbiddenError();
  return { userId };
}
