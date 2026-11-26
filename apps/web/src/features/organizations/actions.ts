"use server";

/**
 * Server actions d'organisation : création, organisation active, invitations, membres.
 * Contrat pour le front : README.md du module. Règles : docs/security.md.
 *
 * Ordre IMPOSÉ : requireTenant(orgSlug, rôle) -> validation Zod -> contrôles métier sur
 * des lignes lues via le repository (tenantWhere) -> écriture via Better Auth (auth.api.*),
 * qui applique lui aussi ses propres contrôles (défense en profondeur).
 */
import { headers } from "next/headers";

import {
  appErrorCode,
  betterAuthErrorCode,
  fail,
  invalidInput,
  ok,
  type ActionResult,
} from "@/lib/actions";
import { auth } from "@/lib/auth/server";
import { listUserMemberships, requireSession, requireTenant } from "@/lib/db/tenant";
import { AUTH_RATE_LIMITS, consumeRateLimit } from "@/lib/rate-limit";

import { countOwners, getInvitation, getMember } from "./repository";
import {
  createOrganizationSchema,
  invitationIdSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
} from "./schemas";
import type {
  AcceptInvitationResult,
  CancelInvitationResult,
  CreateOrganizationResult,
  InviteMemberResult,
  RejectInvitationResult,
  RemoveMemberResult,
  SetActiveOrganizationResult,
  UpdateMemberRoleResult,
} from "./types";

/** Codes Better Auth -> codes d'action stables. */
const BETTER_AUTH_ERRORS: Record<string, string> = {
  ORGANIZATION_ALREADY_EXISTS: "SLUG_TAKEN",
  ORGANIZATION_SLUG_ALREADY_TAKEN: "SLUG_TAKEN",
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "ALREADY_MEMBER",
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "ALREADY_INVITED",
  INVITATION_NOT_FOUND: "INVITATION_INVALID",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "NOT_RECIPIENT",
  EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: "EMAIL_NOT_VERIFIED",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "LAST_OWNER",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "LAST_OWNER",
  MEMBER_NOT_FOUND: "NOT_FOUND",
  ROLE_NOT_ALLOWED: "INVALID_INPUT",
  ROLE_NOT_FOUND: "INVALID_INPUT",
};

/**
 * Exécute une action et convertit les erreurs attendues en codes :
 * 401/403/404 de requireTenant()/repository, erreurs connues de Better Auth.
 * Toute autre erreur est relancée.
 */
async function run<T, E extends string>(
  action: () => Promise<ActionResult<T, E>>,
): Promise<ActionResult<T, E>> {
  try {
    return await action();
  } catch (error) {
    const appCode = appErrorCode(error);
    if (appCode) return fail(appCode as E);
    const code = betterAuthErrorCode(error);
    if (code) {
      if (BETTER_AUTH_ERRORS[code]) return fail(BETTER_AUTH_ERRORS[code] as E);
      if (code.startsWith("YOU_ARE_NOT_") || code.startsWith("USER_IS_NOT_")) {
        return fail("FORBIDDEN" as E);
      }
    }
    throw error;
  }
}

/** Crée une organisation pour l'utilisateur connecté, qui en devient owner. */
export async function createOrganization(input: unknown): Promise<CreateOrganizationResult> {
  return run(async () => {
    await requireSession();
    const parsed = createOrganizationSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    const organization = await auth.api.createOrganization({
      body: { name: parsed.data.name, slug: parsed.data.slug },
      headers: await headers(),
    });
    return ok({ slug: organization!.slug });
  });
}

/** Change l'organisation active de la session (l'utilisateur doit en être membre). */
export async function setActiveOrganization(orgSlug: string): Promise<SetActiveOrganizationResult> {
  return run(async () => {
    const ctx = await requireTenant(orgSlug);
    await auth.api.setActiveOrganization({
      body: { organizationId: ctx.organizationId },
      headers: await headers(),
    });
    return ok();
  });
}

/**
 * Invite une adresse email avec un rôle obligatoire.
 * owner : uniquement par un owner ; manager et staff : par un owner ou un manager ;
 * un staff ne peut pas inviter.
 */
export async function inviteMember(orgSlug: string, input: unknown): Promise<InviteMemberResult> {
  return run(async () => {
    const ctx = await requireTenant(orgSlug, "manager");
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const { email, role } = parsed.data;

    if (role === "owner" && ctx.role !== "owner") return fail("FORBIDDEN");
    if (!consumeRateLimit(`invite:${ctx.organizationId}`, AUTH_RATE_LIMITS.invitation)) {
      return fail("RATE_LIMITED");
    }

    const created = await auth.api.createInvitation({
      body: { email, role, organizationId: ctx.organizationId },
      headers: await headers(),
    });
    return ok({ invitationId: created.id, expiresAt: new Date(created.expiresAt) });
  });
}

/** Annule une invitation en attente de l'organisation (owner ou manager). */
export async function cancelInvitation(
  orgSlug: string,
  input: unknown,
): Promise<CancelInvitationResult> {
  return run(async () => {
    const ctx = await requireTenant(orgSlug, "manager");
    const parsed = invitationIdSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    // NotFoundError si l'invitation appartient à une autre organisation.
    const target = await getInvitation(ctx, parsed.data.invitationId);
    if (target.role === "owner" && ctx.role !== "owner") return fail("FORBIDDEN");

    await auth.api.cancelInvitation({
      body: { invitationId: target.invitationId },
      headers: await headers(),
    });
    return ok();
  });
}

/**
 * Accepte une invitation. Exige d'être connecté avec la MÊME adresse email, vérifiée,
 * et une invitation non expirée.
 */
export async function acceptInvitation(input: unknown): Promise<AcceptInvitationResult> {
  return run<{ organizationSlug: string }, AcceptInvitationErrorCode>(async () => {
    const user = await requireSession();
    const parsed = invitationIdSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    const accepted = await auth.api.acceptInvitation({
      body: { invitationId: parsed.data.invitationId },
      headers: await headers(),
    });
    const organizationId = accepted?.invitation.organizationId;
    const membership = (await listUserMemberships(user.userId)).find(
      (m) => m.organizationId === organizationId,
    );
    if (!membership) return fail("INVITATION_INVALID");
    return ok({ organizationSlug: membership.slug });
  });
}

type AcceptInvitationErrorCode = Extract<AcceptInvitationResult, { ok: false }>["error"];

/** Refuse une invitation (même conditions que l'acceptation). */
export async function rejectInvitation(input: unknown): Promise<RejectInvitationResult> {
  return run(async () => {
    await requireSession();
    const parsed = invitationIdSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    await auth.api.rejectInvitation({
      body: { invitationId: parsed.data.invitationId },
      headers: await headers(),
    });
    return ok();
  });
}

/**
 * Change le rôle d'un membre (owner ou manager). Seul un owner peut nommer ou modifier
 * un owner ; le dernier owner ne peut pas être rétrogradé.
 */
export async function updateMemberRole(
  orgSlug: string,
  input: unknown,
): Promise<UpdateMemberRoleResult> {
  return run(async () => {
    const ctx = await requireTenant(orgSlug, "manager");
    const parsed = updateMemberRoleSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const { memberId, role } = parsed.data;

    // NotFoundError si le membre appartient à une autre organisation.
    const target = await getMember(ctx, memberId);
    const touchesOwner = target.role === "owner" || role === "owner";
    if (touchesOwner && ctx.role !== "owner") return fail("FORBIDDEN");
    if (target.role === "owner" && role !== "owner" && (await countOwners(ctx)) <= 1) {
      return fail("LAST_OWNER");
    }

    await auth.api.updateMemberRole({
      body: { memberId: target.memberId, role, organizationId: ctx.organizationId },
      headers: await headers(),
    });
    return ok();
  });
}

/**
 * Retire un membre (owner ou manager). Seul un owner peut retirer un owner ;
 * le dernier owner ne peut pas être retiré.
 */
export async function removeMember(orgSlug: string, input: unknown): Promise<RemoveMemberResult> {
  return run(async () => {
    const ctx = await requireTenant(orgSlug, "manager");
    const parsed = removeMemberSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    const target = await getMember(ctx, parsed.data.memberId);
    if (target.role === "owner") {
      if (ctx.role !== "owner") return fail("FORBIDDEN");
      if ((await countOwners(ctx)) <= 1) return fail("LAST_OWNER");
    }

    await auth.api.removeMember({
      body: { memberIdOrEmail: target.memberId, organizationId: ctx.organizationId },
      headers: await headers(),
    });
    return ok();
  });
}
