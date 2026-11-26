import { z } from "zod";

import {
  emailSchema,
  localeSchema,
  organizationNameSchema,
  organizationSlugSchema,
  passwordSchema,
  personNameSchema,
} from "@/lib/validation";

/** Inscription : crée le compte ET son organisation (l'utilisateur en devient owner). */
export const signUpSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  organizationName: organizationNameSchema,
  organizationSlug: organizationSlugSchema,
  locale: localeSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  // Pas de contrainte de longueur à la connexion : l'erreur doit rester générique.
  password: z.string().min(1).max(256),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
  locale: localeSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: passwordSchema,
});

export const sendVerificationEmailSchema = z.object({
  locale: localeSchema,
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignInInput = z.input<typeof signInSchema>;
export type RequestPasswordResetInput = z.input<typeof requestPasswordResetSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type SendVerificationEmailInput = z.input<typeof sendVerificationEmailSchema>;
