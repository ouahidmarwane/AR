# organizations

Organisations (tenants), organisation active, membres, rôles owner/manager/staff et invitations.

## Contrat pour le front

Importer uniquement depuis `@/features/organizations`. Les actions renvoient `{ ok: true, data }` ou `{ ok: false, error, fieldErrors? }` (`ActionResult`) ; les lectures (Server Components) lèvent une erreur 401/403 sans session ou sans appartenance. `orgSlug` est le segment `[org]` de l'URL `/[locale]/app/[org]` : il sert seulement à choisir l'organisation, l'appartenance et le rôle sont vérifiés côté serveur.

Codes communs à toutes les actions : `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`.

| Action                             | Qui                                                          | Entrée                                                           | `data` si ok                           | Codes spécifiques                                                                               |
| ---------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `createOrganization(input)`        | tout utilisateur connecté                                    | `name`, `slug`                                                   | `{ slug }` (le créateur devient owner) | `SLUG_TAKEN`                                                                                    |
| `setActiveOrganization(orgSlug)`   | membre                                                       | —                                                                | —                                      | —                                                                                               |
| `inviteMember(orgSlug, input)`     | owner, manager                                               | `email`, `role` : `owner` (owner uniquement), `manager`, `staff` | `{ invitationId, expiresAt }` (48 h)   | `ALREADY_MEMBER`, `ALREADY_INVITED`                                                             |
| `cancelInvitation(orgSlug, input)` | owner, manager                                               | `invitationId`                                                   | —                                      | —                                                                                               |
| `acceptInvitation(input)`          | l'invité, connecté avec **la même adresse, vérifiée**        | `invitationId`                                                   | `{ organizationSlug }`                 | `INVITATION_INVALID` (inconnue, expirée ou déjà traitée), `NOT_RECIPIENT`, `EMAIL_NOT_VERIFIED` |
| `rejectInvitation(input)`          | l'invité (mêmes conditions)                                  | `invitationId`                                                   | —                                      | idem                                                                                            |
| `updateMemberRole(orgSlug, input)` | owner, manager (owner seul pour nommer ou modifier un owner) | `memberId`, `role`                                               | —                                      | `LAST_OWNER`                                                                                    |
| `removeMember(orgSlug, input)`     | owner, manager (owner seul pour retirer un owner)            | `memberId`                                                       | —                                      | `LAST_OWNER`                                                                                    |

| Lecture (Server Component)        | Qui            | Retour                                                                             |
| --------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `getMyOrganizations()`            | connecté       | `Membership[]` : `{ organizationId, slug, name, role }` (sélecteur d'organisation) |
| `getMyRole(orgSlug)`              | membre         | `"owner" \| "manager" \| "staff"` (pour masquer les boutons non autorisés)         |
| `getOrganizationMembers(orgSlug)` | membre         | `OrganizationMember[]` : `{ memberId, userId, name, email, role, joinedAt }`       |
| `getPendingInvitations(orgSlug)`  | owner, manager | `PendingInvitation[]` : `{ invitationId, email, role, expiresAt, createdAt }`      |

### Règles affichées à l'utilisateur

- Un staff ne voit pas les actions d'invitation et de gestion des membres (elles renverraient `FORBIDDEN`).
- Le dernier owner ne peut être ni retiré ni rétrogradé (`LAST_OWNER`) : proposer d'abord de nommer un autre owner.
- Le lien d'invitation reçu par email est `/[locale]/invitation/[invitationId]` : la page doit demander de se connecter (ou de créer un compte) **avec l'adresse invitée**, puis de vérifier l'email si besoin, avant d'appeler `acceptInvitation`.
