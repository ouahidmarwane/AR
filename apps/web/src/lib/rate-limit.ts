/**
 * Limitation de fréquence en mémoire (fenêtre fixe) pour les server actions sensibles.
 *
 * Le rate limit intégré à Better Auth ne s'applique qu'aux requêtes HTTP vers /api/auth/* :
 * les appels auth.api.* faits depuis nos server actions ne le traversent pas, d'où ce module.
 * Mémoire du processus : suffisant pour une instance Node unique (Hostinger) ; à remplacer
 * par un stockage partagé (MySQL, Redis) si l'app tourne sur plusieurs instances.
 */

export type RateLimitRule = { max: number; windowMs: number };

export const AUTH_RATE_LIMITS = {
  /** Par IP : tentatives de connexion. */
  signInByIp: { max: 10, windowMs: 60_000 },
  /** Par email : protège un compte précis contre le brute force. */
  signInByEmail: { max: 5, windowMs: 15 * 60_000 },
  signUp: { max: 5, windowMs: 60 * 60_000 },
  passwordReset: { max: 3, windowMs: 15 * 60_000 },
  verificationEmail: { max: 3, windowMs: 15 * 60_000 },
  invitation: { max: 30, windowMs: 60 * 60_000 },
} satisfies Record<string, RateLimitRule>;

const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

/** Consomme une unité ; renvoie false si la limite est atteinte pour cette clé. */
export function consumeRateLimit(key: string, rule: RateLimitRule, now = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return true;
  }
  if (bucket.count >= rule.max) return false;
  bucket.count += 1;
  return true;
}

/**
 * IP du client : premier élément de X-Forwarded-For (posé par le proxy de l'hébergeur),
 * sinon X-Real-IP. Ces en-têtes ne sont fiables que derrière un proxy qui les réécrit.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Réservé aux tests. */
export function resetRateLimits(): void {
  buckets.clear();
}
