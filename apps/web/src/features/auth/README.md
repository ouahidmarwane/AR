# auth

Authentification Better Auth : inscription (avec création d'organisation), connexion, déconnexion, vérification d'email et réinitialisation de mot de passe.

## Contrat pour le front

Importer uniquement depuis `@/features/auth`. Toutes les actions sont des **server actions** : elles renvoient `{ ok: true, data }` ou `{ ok: false, error, fieldErrors? }` (`ActionResult`, `src/lib/actions.ts`). Les codes `error` sont stables : à traduire dans `messages/`. Les schémas Zod exportés peuvent être réutilisés pour la validation côté client.

| Action                          | Entrée                                                                                                                             | `data` si ok                                                                            | Codes d'erreur                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `signUp(input)`                 | `SignUpInput` : `name`, `email`, `password` (10 à 128 car.), `organizationName`, `organizationSlug` (`a-z0-9-`, 3 à 48), `locale?` | `{ organizationSlug }` : rediriger vers `/[locale]/app/[organizationSlug]`              | `INVALID_INPUT`, `RATE_LIMITED`, `EMAIL_UNAVAILABLE`, `SLUG_TAKEN` |
| `signIn(input)`                 | `SignInInput` : `email`, `password`                                                                                                | `{ organizationSlug \| null }` : organisation vers laquelle rediriger (`null` : aucune) | `INVALID_CREDENTIALS` (toujours générique), `RATE_LIMITED`         |
| `signOut()`                     | —                                                                                                                                  | —                                                                                       | —                                                                  |
| `requestPasswordReset(input)`   | `email`, `locale?`                                                                                                                 | — (même réponse que le compte existe ou non)                                            | `INVALID_INPUT`, `RATE_LIMITED`                                    |
| `resetPassword(input)`          | `token` (paramètre `?token=` de la page), `newPassword`                                                                            | — : toutes les sessions sont déconnectées                                               | `INVALID_INPUT`, `INVALID_TOKEN`                                   |
| `sendVerificationEmail(input?)` | `locale?`                                                                                                                          | —                                                                                       | `UNAUTHENTICATED`, `ALREADY_VERIFIED`, `RATE_LIMITED`              |

| Lecture (Server Component) | Retour                                         |
| -------------------------- | ---------------------------------------------- |
| `getCurrentUser()`         | `{ id, name, email, emailVerified }` ou `null` |

### Pages attendues côté front

| Page                                 | Rôle                                                                                      |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| `/[locale]/login`                    | `signIn` ; respecter `?next=` (posé par le proxy) pour la redirection                     |
| `/[locale]/signup`                   | `signUp` (compte + organisation)                                                          |
| `/[locale]/forgot-password`          | `requestPasswordReset` ; toujours afficher « si un compte existe, un email a été envoyé » |
| `/[locale]/reset-password?token=...` | `resetPassword` (lien reçu par email, valable 1 h)                                        |

La vérification d'email est traitée par Better Auth (`/api/auth/verify-email`), qui redirige ensuite vers le dashboard. La connexion reste possible avant vérification, mais **accepter une invitation exige un email vérifié** (voir `features/organizations`).

### Emails en local

`EMAIL_DRIVER=console` : les emails (vérification, réinitialisation, invitation) ne sont pas envoyés, leurs liens s'affichent dans le terminal de `pnpm dev`.
