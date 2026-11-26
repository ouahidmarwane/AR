import type { EmailSender } from "./types";

/**
 * TODO : pilote Resend (RESEND_API_KEY, EMAIL_FROM).
 * - envoyer text + html (templates React Email, issue « Emails React Email ») ;
 * - journaliser les échecs sans jamais logguer les liens (ils contiennent des jetons).
 */
export function createResendEmailSender(): EmailSender {
  throw new Error("Le pilote d'email resend n'est pas encore implémenté (EMAIL_DRIVER=console).");
}
