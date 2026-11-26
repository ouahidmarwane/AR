import { z } from "zod";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import { ORG_ROLES } from "@/lib/auth/permissions";

/**
 * Schémas Zod élémentaires partagés par plusieurs modules (auth, organizations).
 * Utilisables côté client et serveur : aucun import serveur ici.
 */

export const emailSchema = z.email().trim().toLowerCase().max(255);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `au moins ${PASSWORD_MIN_LENGTH} caractères`)
  .max(PASSWORD_MAX_LENGTH);

export const personNameSchema = z.string().trim().min(1).max(255);

export const organizationNameSchema = z.string().trim().min(2).max(120);

/** Slug d'organisation : utilisé dans les URL (/[locale]/app/[slug]). */
export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "lettres minuscules, chiffres et tirets uniquement (pas de tiret au début ni à la fin)",
  );

/** Rôle d'organisation obligatoire : owner | manager | staff. */
export const orgRoleSchema = z.enum(ORG_ROLES);

export const localeSchema = z.enum(["fr", "ar", "en"]).default("fr");
