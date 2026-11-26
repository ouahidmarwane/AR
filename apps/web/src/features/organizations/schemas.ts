import { z } from "zod";

import {
  emailSchema,
  organizationNameSchema,
  organizationSlugSchema,
  orgRoleSchema,
} from "@/lib/validation";

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
});

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema,
});

const idSchema = z.string().min(1).max(64);

export const invitationIdSchema = z.object({ invitationId: idSchema });

export const updateMemberRoleSchema = z.object({
  memberId: idSchema,
  role: orgRoleSchema,
});

export const removeMemberSchema = z.object({ memberId: idSchema });

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
export type InvitationIdInput = z.input<typeof invitationIdSchema>;
export type UpdateMemberRoleInput = z.input<typeof updateMemberRoleSchema>;
export type RemoveMemberInput = z.input<typeof removeMemberSchema>;
