import { z } from "zod";

/**
 * Validation des variables d'environnement (voir .env.example).
 * Les variables sont validées à la première lecture (et non à l'import)
 * pour que `next build` fonctionne sans .env.local.
 */

/** Une valeur vide dans .env (`KEY=`) est traitée comme absente. */
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  CLAUDE_MENU_MODEL: z.string().min(1).default("claude-sonnet-5-5"),
  PAYMENT_PROVIDER: z.enum(["manual"]).default("manual"),
  PAYMENT_SECRET_KEY: optionalString,
  PAYMENT_WEBHOOK_SECRET: optionalString,
  GPU_ENDPOINT_URL: z.preprocess((value) => (value === "" ? undefined : value), z.url().optional()),
  GPU_API_KEY: optionalString,
  GPU_WEBHOOK_SECRET: optionalString,
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
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
