import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Rôles d'un membre dans une organisation (plugin organization de Better Auth).
 * Partagé entre le serveur et le client. La hiérarchie utilisée par
 * requireTenant() est définie dans src/lib/db/tenant.ts.
 */
export const ORG_ROLES = ["owner", "manager", "staff"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Rôle donné au créateur d'une organisation (option creatorRole du plugin). */
export const CREATOR_ROLE: OrgRole = "owner";

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}

/**
 * Valide un rôle reçu par Better Auth (invitation, ajout de membre, changement de rôle).
 * Better Auth accepte une chaîne, une liste séparée par des virgules ou un tableau.
 * Renvoie la liste des rôles si TOUS sont dans ORG_ROLES, sinon null : un rôle absent,
 * vide, "member", "admin" ou toute autre valeur est refusé.
 */
export function parseOrgRoles(role: unknown): OrgRole[] | null {
  const raw =
    typeof role === "string" ? role.split(",") : Array.isArray(role) ? (role as unknown[]) : [];
  const values = raw.map((value) => (typeof value === "string" ? value.trim() : value));
  if (values.length === 0 || !values.every(isOrgRole)) return null;
  return values;
}

// TODO : ajouter les permissions métier (restaurant, menu, qr-code...) quand elles existeront.
export const statements = { ...defaultStatements } as const;

export const ac = createAccessControl(statements);

export const roles = {
  owner: ac.newRole({ ...ownerAc.statements }),
  manager: ac.newRole({ ...adminAc.statements }),
  staff: ac.newRole({ ...memberAc.statements }),
};
