import { z } from "zod";

/**
 * Validation des variables d'environnement (voir .env.example).
 * Les variables sont validées à la première lecture (et non à l'import d'env.ts).
 * Les variables MYSQL_* ne servent qu'à docker compose : l'app ne lit que DATABASE_URL.
 */

/** Une valeur vide dans .env (`KEY=`) est traitée comme absente. */
const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
});

const serverSchema = z.object({
  // Base de données
  DATABASE_URL: z
    .string()
    .regex(/^mysql:\/\//, "doit être une URL mysql://user:password@host:port/base"),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(5),

  // Authentification
  BETTER_AUTH_SECRET: z.string().min(32, "au moins 32 caractères (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.url(),

  // Stockage des fichiers
  STORAGE_DRIVER: z.enum(["local", "r2"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().min(1).default("../../storage"),

  // IA
  ANTHROPIC_API_KEY: optionalString,
  CLAUDE_MENU_MODEL: z.string().min(1).default("claude-sonnet-5-5"),

  // Paiement
  PAYMENT_PROVIDER: z.enum(["manual"]).default("manual"),
  PAYMENT_SECRET_KEY: optionalString,
  PAYMENT_WEBHOOK_SECRET: optionalString,

  // Worker GPU (phase 5)
  GPU_ENDPOINT_URL: optionalUrl,
  GPU_API_KEY: optionalString,
  GPU_WEBHOOK_SECRET: optionalString,

  // E-mail et observabilité
  EMAIL_DRIVER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().min(1).default("AR Menu <no-reply@localhost>"),
  RESEND_API_KEY: optionalString,
  SENTRY_DSN: optionalString,
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

let publicEnv: PublicEnv | undefined;
let serverEnv: ServerEnv | undefined;

/** Variables publiques (NEXT_PUBLIC_*), utilisables côté client et serveur. */
export function getPublicEnv(): PublicEnv {
  if (publicEnv) return publicEnv;

  // Accès explicites : Next.js n'injecte dans le bundle client que les
  // références littérales `process.env.NEXT_PUBLIC_*`.
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement publiques invalides :\n${formatIssues(parsed.error)}`,
    );
  }
  publicEnv = parsed.data;
  return publicEnv;
}

/** Variables serveur (secrets). Ne jamais appeler depuis un composant client. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() ne doit jamais être appelé côté client.");
  }
  if (serverEnv) return serverEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Variables d'environnement serveur invalides :\n${formatIssues(parsed.error)}`);
  }
  serverEnv = parsed.data;
  return serverEnv;
}
