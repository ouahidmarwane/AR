import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getServerEnv } from "@/lib/env";

import { ac, CREATOR_ROLE, ORG_ROLES, parseOrgRoles, roles } from "./permissions";

const env = getServerEnv();

/** Rejette (400) tout rôle absent ou hors de owner | manager | staff. */
function assertAllowedRole(role: unknown): void {
  if (!parseOrgRoles(role)) {
    throw new APIError("BAD_REQUEST", {
      code: "ROLE_NOT_ALLOWED",
      message: `Rôle invalide : rôle obligatoire parmi ${ORG_ROLES.join(", ")}.`,
    });
  }
}

/**
 * Instance Better Auth (serveur uniquement).
 * Le schéma des tables d'auth est généré par :
 *   pnpm dlx auth@<version de better-auth> generate --config src/lib/auth/server.ts --output src/lib/db/schema/auth.ts
 * puis `pnpm db:generate` pour créer la migration.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "mysql", schema }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      /** Accès au back-office. Jamais modifiable par l'utilisateur (input: false). */
      isSuperAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  plugins: [
    organization({
      ac,
      roles,
      // Le créateur d'une organisation en devient owner.
      creatorRole: CREATOR_ROLE,
      // Better Auth accepte aussi ses rôles intégrés (owner, admin, member) : on les
      // refuse ici pour que seuls owner | manager | staff puissent être attribués
      // (voir docs/security.md, "Rôles d'organisation").
      organizationHooks: {
        beforeCreateInvitation: async ({ invitation }) => {
          assertAllowedRole(invitation.role);
        },
        beforeAddMember: async ({ member }) => {
          assertAllowedRole(member.role);
        },
        beforeUpdateMemberRole: async ({ newRole }) => {
          assertAllowedRole(newRole);
        },
      },
    }),
    // Doit rester le dernier plugin : écrit les cookies depuis les Server Actions.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
