/** Message transactionnel (vérification d'email, réinitialisation, invitation...). */
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Contrat commun aux pilotes d'envoi (console, resend...). */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
