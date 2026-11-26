"use server";

/**
 * Server actions d'authentification (contrat pour le front : README.md du module).
 *
 * - Entrées validées par Zod (schemas.ts), erreurs renvoyées sous forme de codes stables.
 * - Rate limiting par IP / email (src/lib/rate-limit.ts) : auth.api.* ne passe pas par
 *   le rate limit HTTP de Better Auth.
 * - Les cookies de session sont posés par le plugin nextCookies de Better Auth.
 */
import { headers } from "next/headers";

import { fail, invalidInput, ok } from "@/lib/actions";
import { auth } from "@/lib/auth/server";
import { listUserMemberships, requireSession } from "@/lib/db/tenant";
import { getPublicEnv } from "@/lib/env";
import { UnauthenticatedError } from "@/lib/errors";
import { AUTH_RATE_LIMITS, clientIp, consumeRateLimit } from "@/lib/rate-limit";

import {
  requestPasswordResetSchema,
  resetPasswordSchema,
  sendVerificationEmailSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";
import type {
  RequestPasswordResetResult,
  ResetPasswordResult,
  SendVerificationEmailResult,
  SignInResult,
  SignOutResult,
  SignUpResult,
} from "./types";

const appUrl = () => getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

/**
 * Inscription email + mot de passe, puis création de l'organisation dont l'utilisateur
 * devient owner. Un email de vérification est envoyé ; la session est ouverte.
 */
export async function signUp(input: unknown): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { name, email, password, organizationName, organizationSlug, locale } = parsed.data;

  const requestHeaders = await headers();
  if (!consumeRateLimit(`sign-up:${clientIp(requestHeaders)}`, AUTH_RATE_LIMITS.signUp)) {
    return fail("RATE_LIMITED");
  }

  // Vérifié AVANT de créer le compte, pour ne pas laisser de compte sans organisation.
  try {
    await auth.api.checkOrganizationSlug({ body: { slug: organizationSlug } });
  } catch {
    return fail("SLUG_TAKEN");
  }

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name, email, password, callbackURL: `${appUrl()}/${locale}/app/${organizationSlug}` },
      headers: requestHeaders,
    });
    userId = result.user.id;
  } catch {
    // Better Auth refuse surtout un email déjà utilisé (le mot de passe est déjà validé par Zod).
    return fail("EMAIL_UNAVAILABLE");
  }

  try {
    // Appel serveur avec userId : le créateur reçoit le rôle owner (creatorRole).
    await auth.api.createOrganization({
      body: { name: organizationName, slug: organizationSlug, userId },
    });
  } catch {
    // Slug pris entre la vérification et la création : on annule l'inscription.
    const context = await auth.$context;
    await context.internalAdapter.deleteUser(userId);
    return fail("SLUG_TAKEN");
  }

  return ok({ organizationSlug });
}

/** Connexion. Toute erreur renvoie INVALID_CREDENTIALS (ne révèle pas si l'email existe). */
export async function signIn(input: unknown): Promise<SignInResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_CREDENTIALS");
  const { email, password } = parsed.data;

  const requestHeaders = await headers();
  const allowedByIp = consumeRateLimit(
    `sign-in:ip:${clientIp(requestHeaders)}`,
    AUTH_RATE_LIMITS.signInByIp,
  );
  const allowedByEmail = consumeRateLimit(`sign-in:email:${email}`, AUTH_RATE_LIMITS.signInByEmail);
  if (!allowedByIp || !allowedByEmail) return fail("RATE_LIMITED");

  try {
    const result = await auth.api.signInEmail({
      body: { email, password },
      headers: requestHeaders,
    });
    // Organisation vers laquelle rediriger après connexion (null : aucune organisation).
    const memberships = await listUserMemberships(result.user.id);
    return ok({ organizationSlug: memberships[0]?.slug ?? null });
  } catch {
    return fail("INVALID_CREDENTIALS");
  }
}

/** Déconnexion : la session est supprimée en base et le cookie effacé. */
export async function signOut(): Promise<SignOutResult> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Déjà déconnecté : rien à faire.
  }
  return ok();
}

/**
 * Demande de réinitialisation : envoie un lien par email s'il existe un compte.
 * Répond toujours ok (sauf entrée invalide ou rate limit) pour ne pas révéler les comptes.
 */
export async function requestPasswordReset(input: unknown): Promise<RequestPasswordResetResult> {
  const parsed = requestPasswordResetSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);
  const { email, locale } = parsed.data;

  const requestHeaders = await headers();
  const allowed =
    consumeRateLimit(`reset:ip:${clientIp(requestHeaders)}`, AUTH_RATE_LIMITS.passwordReset) &&
    consumeRateLimit(`reset:email:${email}`, AUTH_RATE_LIMITS.passwordReset);
  if (!allowed) return fail("RATE_LIMITED");

  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${appUrl()}/${locale}/reset-password` },
    });
  } catch {
    // Même réponse dans tous les cas.
  }
  return ok();
}

/** Nouveau mot de passe à partir du jeton reçu par email. Déconnecte toutes les sessions. */
export async function resetPassword(input: unknown): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  try {
    await auth.api.resetPassword({ body: parsed.data });
    return ok();
  } catch {
    return fail("INVALID_TOKEN");
  }
}

/** Renvoie l'email de vérification à l'utilisateur connecté. */
export async function sendVerificationEmail(
  input: unknown = {},
): Promise<SendVerificationEmailResult> {
  const parsed = sendVerificationEmailSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error);

  let user;
  try {
    user = await requireSession();
  } catch (error) {
    if (error instanceof UnauthenticatedError) return fail("UNAUTHENTICATED");
    throw error;
  }
  if (user.emailVerified) return fail("ALREADY_VERIFIED");
  if (!consumeRateLimit(`verify:${user.userId}`, AUTH_RATE_LIMITS.verificationEmail)) {
    return fail("RATE_LIMITED");
  }

  await auth.api.sendVerificationEmail({
    body: { email: user.email, callbackURL: `${appUrl()}/${parsed.data.locale}/app` },
  });
  return ok();
}
