import type { EmailMessage } from "./types";

/**
 * Messages texte minimaux (FR). Les versions soignées et multilingues viendront
 * avec React Email (issue « Emails React Email »).
 */

export function verificationEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Confirmez votre adresse email",
    text: `Bienvenue sur AR Menu.\n\nConfirmez votre adresse email en ouvrant ce lien :\n${url}\n\nSi vous n'êtes pas à l'origine de cette inscription, ignorez ce message.`,
  };
}

export function resetPasswordEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Réinitialisation de votre mot de passe",
    text: `Pour choisir un nouveau mot de passe, ouvrez ce lien (valable 1 heure) :\n${url}\n\nSi vous n'avez rien demandé, ignorez ce message : votre mot de passe reste inchangé.`,
  };
}

export function invitationEmail(params: {
  to: string;
  url: string;
  organizationName: string;
  inviterName: string;
  role: string;
}): EmailMessage {
  return {
    to: params.to,
    subject: `Invitation à rejoindre ${params.organizationName} sur AR Menu`,
    text: `${params.inviterName} vous invite à rejoindre ${params.organizationName} (rôle : ${params.role}).\n\nAcceptez l'invitation en vous connectant avec cette adresse email (${params.to}) :\n${params.url}\n\nCe lien expire dans 48 heures.`,
  };
}
