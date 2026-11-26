import type { ActionResult, CommonActionError } from "@/lib/actions";
import type { Membership, Role } from "@/lib/db/tenant";

export type { OrganizationMember, PendingInvitation } from "./repository";
export type {
  CreateOrganizationInput,
  InvitationIdInput,
  InviteMemberInput,
  RemoveMemberInput,
  UpdateMemberRoleInput,
} from "./schemas";
export type { Membership, Role };

/** Codes d'erreur des actions d'organisation (à traduire côté front). */
export type CreateOrganizationError = CommonActionError | "SLUG_TAKEN";
export type InviteMemberError = CommonActionError | "ALREADY_MEMBER" | "ALREADY_INVITED";
export type InvitationResponseError =
  CommonActionError | "INVITATION_INVALID" | "NOT_RECIPIENT" | "EMAIL_NOT_VERIFIED";
export type MemberUpdateError = CommonActionError | "LAST_OWNER";

export type CreateOrganizationResult = ActionResult<{ slug: string }, CreateOrganizationError>;
export type SetActiveOrganizationResult = ActionResult<void, CommonActionError>;
export type InviteMemberResult = ActionResult<
  { invitationId: string; expiresAt: Date },
  InviteMemberError
>;
export type CancelInvitationResult = ActionResult<void, CommonActionError>;
export type AcceptInvitationResult = ActionResult<
  { organizationSlug: string },
  InvitationResponseError
>;
export type RejectInvitationResult = ActionResult<void, InvitationResponseError>;
export type UpdateMemberRoleResult = ActionResult<void, MemberUpdateError>;
export type RemoveMemberResult = ActionResult<void, MemberUpdateError>;
