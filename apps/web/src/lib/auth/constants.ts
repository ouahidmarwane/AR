// Constantes d'authentification partagées entre le serveur (Better Auth) et le client
// (schémas Zod des formulaires). Aucun import serveur ici.

/** Longueur minimale du mot de passe. */
export const PASSWORD_MIN_LENGTH = 10;
/** Longueur maximale du mot de passe. */
export const PASSWORD_MAX_LENGTH = 128;
/** Durée de validité d'une invitation : 48 heures. */
export const INVITATION_EXPIRES_IN_SECONDS = 48 * 60 * 60;
