import { getServerEnv } from "@/lib/env";

import { createConsoleEmailSender } from "./console";
import { createResendEmailSender } from "./resend";
import type { EmailSender } from "./types";

export type { EmailMessage, EmailSender } from "./types";
export { invitationEmail, resetPasswordEmail, verificationEmail } from "./templates";

let sender: EmailSender | undefined;

/** Pilote d'envoi configuré par EMAIL_DRIVER (serveur uniquement). */
export function getEmailSender(): EmailSender {
  if (sender) return sender;
  sender =
    getServerEnv().EMAIL_DRIVER === "resend"
      ? createResendEmailSender()
      : createConsoleEmailSender();
  return sender;
}
