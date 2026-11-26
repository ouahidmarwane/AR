import type { EmailMessage, EmailSender } from "./types";

/** Derniers messages "envoyés" par le pilote console (développement et tests uniquement). */
const outbox: EmailMessage[] = [];
const OUTBOX_MAX = 100;

/**
 * Pilote "console" : n'envoie rien, affiche le message (et ses liens) dans les logs.
 * À utiliser en local uniquement : les liens contiennent des jetons secrets.
 */
export function createConsoleEmailSender(): EmailSender {
  return {
    async send(message) {
      outbox.push(message);
      if (outbox.length > OUTBOX_MAX) outbox.shift();
      if (process.env.NODE_ENV !== "test") {
        console.info(
          `\n[email:console] À : ${message.to}\nObjet : ${message.subject}\n${message.text}\n`,
        );
      }
    },
  };
}

/** Messages envoyés par le pilote console, du plus ancien au plus récent (tests). */
export function getConsoleOutbox(): readonly EmailMessage[] {
  return outbox;
}
