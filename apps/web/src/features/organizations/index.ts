// API publique du module organizations (contrat pour le front : README.md).
// Le repository n'est PAS exporté : on passe toujours par actions/queries (requireTenant).
export {
  acceptInvitation,
  cancelInvitation,
  createOrganization,
  inviteMember,
  rejectInvitation,
  removeMember,
  setActiveOrganization,
  updateMemberRole,
} from "./actions";
export {
  getMyOrganizations,
  getMyRole,
  getOrganizationMembers,
  getPendingInvitations,
} from "./queries";
export {
  createOrganizationSchema,
  invitationIdSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
} from "./schemas";
export type * from "./types";
