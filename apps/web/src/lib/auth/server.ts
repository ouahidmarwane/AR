import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";

import { defaultLocale } from "@/i18n/config";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import {
  getEmailSender,
  invitationEmail,
  resetPasswordEmail,
  verificationEmail,
} from "@/lib/email";
import { getPublicEnv, getServerEnv } from "@/lib/env";

import {
  INVITATION_EXPIRES_IN_SECONDS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./constants";
import { ac, CREATOR_ROLE, ORG_ROLES, parseOrgRoles, roles } from "./permissions";

const env = getServerEnv();
const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/** Rejette (400) tout rôle absent ou hors de owner | manager | staff. */
function assertAllowedRole(role: unknown): void {
  if (!parseOrgRoles(role)) {
    throw new APIError("BAD_REQUEST", {
      code: "ROLE_NOT_ALLOWED",
      message: `Rôle invalide : rôle obligatoire parmi ${ORG_ROLES.join(", ")}.`,
    });
  }
}

/** Première organisation dont l'utilisateur est membre (organisation active par défaut). */
async function firstOrganizationId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ organizationId: schema.member.organizationId })
    .from(schema.member)
    .where(eq(schema.member.userId, userId))
    .orderBy(asc(schema.member.createdAt))
    .limit(1);
  return rows[0]?.organizationId ?? null;
}

/**
 * Instance Better Auth (serveur uniquement). Règles de sécurité : docs/security.md.
 * Le schéma des tables d'auth est généré par :
 *   pnpm dlx auth@<version de better-auth> generate --config src/lib/auth/server.ts --output src/lib/db/schema/auth.ts
 * puis `pnpm db:generate` pour créer la migration.
 */
export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // Seules ces origines peuvent appeler /api/auth/* et servir de redirection (callbackURL).
  trustedOrigins: [...new Set([env.BETTER_AUTH_URL, appUrl])],
  database: drizzleAdapter(db, { provider: "mysql", schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // Connexion possible avant vérification ; la vérification est exigée pour accepter
    // une invitation (requireEmailVerificationOnInvitation). Passer à true pour l'exiger partout.
    requireEmailVerification: false,
    resetPasswordTokenExpiresIn: 60 * 60,
    // Un mot de passe réinitialisé déconnecte toutes les sessions existantes.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await getEmailSender().send(resetPasswordEmail(user.email, url));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await getEmailSender().send(verificationEmail(user.email, url));
    },
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

  // Rate limit des requêtes HTTP vers /api/auth/* (client Better Auth). Les server actions
  // ont leur propre limitation (src/lib/rate-limit.ts), car auth.api.* ne passe pas par ici.
  rateLimit: {
    enabled: true,
    storage: "memory",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 15 * 60, max: 3 },
      "/send-verification-email": { window: 15 * 60, max: 3 },
    },
  },

  advanced: {
    // Cookies "Secure" (HTTPS uniquement) en production.
    useSecureCookies: process.env.NODE_ENV === "production",
    // IP du client derrière le proxy de l'hébergeur (rate limit).
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
  },

  databaseHooks: {
    session: {
      create: {
        // À la connexion, l'organisation active est la première dont l'utilisateur est membre.
        before: async (session) => {
          if (session.activeOrganizationId) return;
          const organizationId = await firstOrganizationId(session.userId);
          return organizationId
            ? { data: { ...session, activeOrganizationId: organizationId } }
            : undefined;
        },
      },
    },
  },

  plugins: [
    organization({
      ac,
      roles,
      // Le créateur d'une organisation en devient owner.
      creatorRole: CREATOR_ROLE,
      invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
      // Accepter une invitation exige une adresse email VÉRIFIÉE identique à celle de
      // l'invitation : sinon, n'importe qui pourrait s'inscrire avec l'email d'un invité
      // (sans le posséder) et rejoindre l'organisation à sa place.
      requireEmailVerificationOnInvitation: true,
      // Réinviter la même adresse remplace l'invitation en attente (nouvelle expiration).
      cancelPendingInvitationsOnReInvite: true,
      sendInvitationEmail: async ({ id, email, role, organization: org, inviter }) => {
        await getEmailSender().send(
          invitationEmail({
            to: email,
            url: `${appUrl}/${defaultLocale}/invitation/${id}`,
            organizationName: org.name,
            inviterName: inviter.user.name,
            role,
          }),
        );
      },
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
