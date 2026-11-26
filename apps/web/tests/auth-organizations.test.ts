/**
 * Parcours d'authentification et d'organisation de bout en bout (issue #2), via les
 * server actions réelles et Better Auth. Seul next/headers est simulé :
 *  - headers() renvoie les en-têtes de "l'acteur" courant (cookie de session + IP) ;
 *  - cookies().set() capture les cookies posés par Better Auth (plugin nextCookies).
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({
  headers: new Headers(),
  jar: new Map<string, string>(),
}));

const nextHeadersMock = vi.hoisted(() => () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) =>
      request.jar.has(name) ? { name, value: request.jar.get(name) } : undefined,
    getAll: () => [...request.jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void request.jar.set(name, value),
    delete: (name: string) => void request.jar.delete(name),
  }),
}));

// Better Auth (nextCookies) importe "next/headers.js" ; notre code importe "next/headers".
vi.mock("next/headers", nextHeadersMock);
vi.mock("next/headers.js", nextHeadersMock);

import { requestPasswordReset, resetPassword, signIn, signOut, signUp } from "@/features/auth";
import {
  acceptInvitation,
  getOrganizationMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
} from "@/features/organizations";
import { auth } from "@/lib/auth/server";
import { db, pool } from "@/lib/db/client";
import { invitation, member, user } from "@/lib/db/schema";
import { requireTenant } from "@/lib/db/tenant";
import { getConsoleOutbox } from "@/lib/email/console";

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

const PASSWORD = "correct-horse-1";
let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++counter}`;
const newIp = () => `10.0.${Math.floor(counter / 250) % 250}.${(++counter % 250) + 1}`;

type Actor = { email: string; userId: string; headers: Headers };

/** En-têtes d'une requête anonyme (nouvelle IP pour ne pas cumuler les rate limits). */
function anonymous(): Headers {
  return new Headers({ "x-forwarded-for": newIp() });
}

/** Exécute une action "dans la requête" de l'acteur et capture les cookies posés. */
async function as<T>(headers: Headers, action: () => Promise<T>): Promise<T> {
  request.headers = headers;
  request.jar.clear();
  return action();
}

/** En-têtes portant les cookies capturés lors de la dernière action. */
function sessionHeaders(): Headers {
  const cookie = [...request.jar].map(([name, value]) => `${name}=${value}`).join("; ");
  return new Headers({ cookie, "x-forwarded-for": newIp() });
}

/** Inscription complète via l'action signUp : compte + organisation (owner). */
async function registerOwner(): Promise<Actor & { orgSlug: string }> {
  const email = `${unique("owner")}@example.test`;
  const orgSlug = unique("org");
  const result = await as(anonymous(), () =>
    signUp({
      name: "Owner",
      email,
      password: PASSWORD,
      organizationName: `Organisation ${orgSlug}`,
      organizationSlug: orgSlug,
    }),
  );
  expect(result).toEqual({ ok: true, data: { organizationSlug: orgSlug } });
  const headers = sessionHeaders();
  const session = await auth.api.getSession({ headers });
  return { email, userId: session!.user.id, headers, orgSlug };
}

/** Compte vérifié sans lien avec les organisations testées (son organisation est ignorée). */
async function registerVerifiedUser(): Promise<Actor> {
  const owner = await registerOwner();
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, owner.userId));
  return owner;
}

/** Invite puis fait accepter : renvoie l'acteur, désormais membre avec le rôle donné. */
async function addMember(
  inviter: Actor,
  orgSlug: string,
  role: "owner" | "manager" | "staff",
): Promise<Actor> {
  const invitee = await registerVerifiedUser();
  const invited = await as(inviter.headers, () =>
    inviteMember(orgSlug, { email: invitee.email, role }),
  );
  expect(invited.ok).toBe(true);
  const accepted = await as(invitee.headers, () =>
    acceptInvitation({ invitationId: invited.ok ? invited.data.invitationId : "" }),
  );
  expect(accepted).toEqual({ ok: true, data: { organizationSlug: orgSlug } });
  return invitee;
}

async function memberIdOf(orgSlug: string, actor: Actor): Promise<string> {
  const members = await as(actor.headers, () => getOrganizationMembers(orgSlug));
  return members.find((m) => m.userId === actor.userId)!.memberId;
}

afterAll(async () => {
  await pool.end();
});

// ---------------------------------------------------------------------------
// Inscription, connexion, déconnexion, mot de passe
// ---------------------------------------------------------------------------

describe("inscription", () => {
  it("crée le compte et l'organisation ; l'utilisateur est owner et passe requireTenant(slug, 'owner')", async () => {
    const owner = await registerOwner();

    await expect(
      as(owner.headers, () => requireTenant(owner.orgSlug, "owner")),
    ).resolves.toMatchObject({
      userId: owner.userId,
      role: "owner",
    });
    // Email de vérification envoyé via le pilote console.
    expect(
      getConsoleOutbox().some((m) => m.to === owner.email && /verify-email/.test(m.text)),
    ).toBe(true);
  });

  it("le lien de vérification valide l'adresse email", async () => {
    const owner = await registerOwner();
    const message = [...getConsoleOutbox()].reverse().find((m) => m.to === owner.email)!;
    const token = new URL(message.text.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

    await auth.api.verifyEmail({ query: { token } });
    const [row] = await db
      .select({ verified: user.emailVerified })
      .from(user)
      .where(eq(user.id, owner.userId));
    expect(row!.verified).toBe(true);
  });

  it("refuse un mot de passe de moins de 10 caractères", async () => {
    const result = await as(anonymous(), () =>
      signUp({
        name: "X",
        email: `${unique("short")}@example.test`,
        password: "123456789",
        organizationName: "Org courte",
        organizationSlug: unique("org"),
      }),
    );
    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });

  it("refuse un slug déjà pris sans créer de compte", async () => {
    const existing = await registerOwner();
    const email = `${unique("taken")}@example.test`;
    const result = await as(anonymous(), () =>
      signUp({
        name: "X",
        email,
        password: PASSWORD,
        organizationName: "Doublon",
        organizationSlug: existing.orgSlug,
      }),
    );
    expect(result).toEqual({ ok: false, error: "SLUG_TAKEN" });
    expect(await db.select().from(user).where(eq(user.email, email))).toHaveLength(0);
  });
});

describe("connexion et déconnexion", () => {
  it("message générique : mauvais mot de passe et email inconnu donnent la même erreur", async () => {
    const owner = await registerOwner();
    const wrongPassword = await as(anonymous(), () =>
      signIn({ email: owner.email, password: "wrong-password-1" }),
    );
    const unknownEmail = await as(anonymous(), () =>
      signIn({ email: `${unique("nobody")}@example.test`, password: PASSWORD }),
    );
    expect(wrongPassword).toEqual({ ok: false, error: "INVALID_CREDENTIALS" });
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("connexion réussie : session valide et organisation de redirection", async () => {
    const owner = await registerOwner();
    const result = await as(anonymous(), () => signIn({ email: owner.email, password: PASSWORD }));
    expect(result).toEqual({ ok: true, data: { organizationSlug: owner.orgSlug } });
    expect(await auth.api.getSession({ headers: sessionHeaders() })).not.toBeNull();
  });

  it("après déconnexion, la session n'est plus valide", async () => {
    const owner = await registerOwner();
    expect(await auth.api.getSession({ headers: owner.headers })).not.toBeNull();

    await as(owner.headers, () => signOut());

    expect(await auth.api.getSession({ headers: owner.headers })).toBeNull();
    await expect(as(owner.headers, () => requireTenant(owner.orgSlug))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rate limit : trop de tentatives sur un même email sont bloquées", async () => {
    const owner = await registerOwner();
    const results = [];
    for (let i = 0; i < 6; i++) {
      results.push(
        await as(anonymous(), () => signIn({ email: owner.email, password: "wrong-password-1" })),
      );
    }
    expect(results.slice(0, 5).every((r) => !r.ok && r.error === "INVALID_CREDENTIALS")).toBe(true);
    expect(results[5]).toEqual({ ok: false, error: "RATE_LIMITED" });
  });
});

describe("réinitialisation du mot de passe", () => {
  it("email inconnu : réponse ok sans envoi (ne révèle pas les comptes)", async () => {
    const email = `${unique("ghost")}@example.test`;
    const result = await as(anonymous(), () => requestPasswordReset({ email }));
    expect(result).toEqual({ ok: true, data: undefined });
    expect(getConsoleOutbox().some((m) => m.to === email)).toBe(false);
  });

  it("lien reçu -> nouveau mot de passe ; les anciennes sessions sont révoquées", async () => {
    const owner = await registerOwner();
    await as(anonymous(), () => requestPasswordReset({ email: owner.email }));
    const message = [...getConsoleOutbox()].reverse().find((m) => m.to === owner.email)!;
    const token = message.text.match(/reset-password\/([^?\s]+)/)![1]!;

    const newPassword = "new-password-42";
    expect(await as(anonymous(), () => resetPassword({ token, newPassword }))).toEqual({
      ok: true,
      data: undefined,
    });
    expect(await auth.api.getSession({ headers: owner.headers })).toBeNull();
    expect(
      await as(anonymous(), () => signIn({ email: owner.email, password: newPassword })),
    ).toMatchObject({ ok: true });
    expect(await as(anonymous(), () => resetPassword({ token, newPassword }))).toEqual({
      ok: false,
      error: "INVALID_TOKEN",
    });
  });
});

// ---------------------------------------------------------------------------
// Invitations et rôles
// ---------------------------------------------------------------------------

describe("invitations", () => {
  let owner: Actor & { orgSlug: string };
  let manager: Actor;
  let staff: Actor;

  beforeAll(async () => {
    owner = await registerOwner();
    manager = await addMember(owner, owner.orgSlug, "manager");
    staff = await addMember(owner, owner.orgSlug, "staff");
  });

  it("l'invité accepté obtient le rôle de l'invitation", async () => {
    await expect(as(manager.headers, () => requireTenant(owner.orgSlug))).resolves.toMatchObject({
      role: "manager",
    });
    await expect(as(staff.headers, () => requireTenant(owner.orgSlug))).resolves.toMatchObject({
      role: "staff",
    });
  });

  it("un staff ne peut pas inviter", async () => {
    const result = await as(staff.headers, () =>
      inviteMember(owner.orgSlug, { email: `${unique("x")}@example.test`, role: "staff" }),
    );
    expect(result).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("un manager ne peut pas inviter un owner, mais peut inviter un staff", async () => {
    const asOwner = await as(manager.headers, () =>
      inviteMember(owner.orgSlug, { email: `${unique("x")}@example.test`, role: "owner" }),
    );
    expect(asOwner).toEqual({ ok: false, error: "FORBIDDEN" });

    const asStaff = await as(manager.headers, () =>
      inviteMember(owner.orgSlug, { email: `${unique("x")}@example.test`, role: "staff" }),
    );
    expect(asStaff.ok).toBe(true);
  });

  it("le rôle est obligatoire et limité à owner | manager | staff", async () => {
    for (const role of [undefined, "member", "admin"]) {
      const result = await as(owner.headers, () =>
        inviteMember(owner.orgSlug, { email: `${unique("x")}@example.test`, role }),
      );
      expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    }
  });

  it("l'email d'invitation contient un lien vers /invitation/<id>", async () => {
    const email = `${unique("mail")}@example.test`;
    const result = await as(owner.headers, () =>
      inviteMember(owner.orgSlug, { email, role: "staff" }),
    );
    const id = result.ok ? result.data.invitationId : "";
    const message = getConsoleOutbox().find((m) => m.to === email)!;
    expect(message.text).toContain(`/fr/invitation/${id}`);
  });

  it("une invitation ne peut pas être acceptée avec une autre adresse email", async () => {
    const intruder = await registerVerifiedUser();
    const invited = await as(owner.headers, () =>
      inviteMember(owner.orgSlug, { email: `${unique("target")}@example.test`, role: "staff" }),
    );
    const result = await as(intruder.headers, () =>
      acceptInvitation({ invitationId: invited.ok ? invited.data.invitationId : "" }),
    );
    expect(result).toEqual({ ok: false, error: "NOT_RECIPIENT" });
    await expect(as(intruder.headers, () => requireTenant(owner.orgSlug))).rejects.toMatchObject({
      status: 403,
    });
  });

  it("une adresse non vérifiée ne peut pas accepter (même si c'est la bonne)", async () => {
    const unverified = await registerOwner();
    const invited = await as(owner.headers, () =>
      inviteMember(owner.orgSlug, { email: unverified.email, role: "staff" }),
    );
    const result = await as(unverified.headers, () =>
      acceptInvitation({ invitationId: invited.ok ? invited.data.invitationId : "" }),
    );
    expect(result).toEqual({ ok: false, error: "EMAIL_NOT_VERIFIED" });
  });

  it("une invitation expirée est refusée", async () => {
    const invitee = await registerVerifiedUser();
    const invited = await as(owner.headers, () =>
      inviteMember(owner.orgSlug, { email: invitee.email, role: "staff" }),
    );
    const invitationId = invited.ok ? invited.data.invitationId : "";
    await db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invitation.id, invitationId));

    const result = await as(invitee.headers, () => acceptInvitation({ invitationId }));
    expect(result).toEqual({ ok: false, error: "INVITATION_INVALID" });
    await expect(as(invitee.headers, () => requireTenant(owner.orgSlug))).rejects.toMatchObject({
      status: 403,
    });
  });
});

// ---------------------------------------------------------------------------
// Gestion des membres et dernier owner
// ---------------------------------------------------------------------------

describe("gestion des membres", () => {
  it("le dernier owner ne peut être ni rétrogradé ni retiré", async () => {
    const owner = await registerOwner();
    const ownerMemberId = await memberIdOf(owner.orgSlug, owner);

    expect(
      await as(owner.headers, () =>
        updateMemberRole(owner.orgSlug, { memberId: ownerMemberId, role: "manager" }),
      ),
    ).toEqual({ ok: false, error: "LAST_OWNER" });
    expect(
      await as(owner.headers, () => removeMember(owner.orgSlug, { memberId: ownerMemberId })),
    ).toEqual({ ok: false, error: "LAST_OWNER" });
    await expect(
      as(owner.headers, () => requireTenant(owner.orgSlug, "owner")),
    ).resolves.toBeTruthy();
  });

  it("avec un second owner, la rétrogradation devient possible", async () => {
    const owner = await registerOwner();
    const secondOwner = await addMember(owner, owner.orgSlug, "owner");
    const ownerMemberId = await memberIdOf(owner.orgSlug, owner);

    expect(
      await as(secondOwner.headers, () =>
        updateMemberRole(owner.orgSlug, { memberId: ownerMemberId, role: "manager" }),
      ),
    ).toEqual({ ok: true, data: undefined });
    await expect(as(owner.headers, () => requireTenant(owner.orgSlug))).resolves.toMatchObject({
      role: "manager",
    });
  });

  it("un manager ne peut ni retirer ni modifier un owner, mais peut gérer un staff", async () => {
    const owner = await registerOwner();
    const manager = await addMember(owner, owner.orgSlug, "manager");
    const staff = await addMember(owner, owner.orgSlug, "staff");
    const ownerMemberId = await memberIdOf(owner.orgSlug, owner);
    const staffMemberId = await memberIdOf(owner.orgSlug, staff);

    expect(
      await as(manager.headers, () => removeMember(owner.orgSlug, { memberId: ownerMemberId })),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(
      await as(manager.headers, () =>
        updateMemberRole(owner.orgSlug, { memberId: staffMemberId, role: "owner" }),
      ),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(
      await as(manager.headers, () =>
        updateMemberRole(owner.orgSlug, { memberId: staffMemberId, role: "manager" }),
      ),
    ).toEqual({ ok: true, data: undefined });
    expect(
      await as(manager.headers, () => removeMember(owner.orgSlug, { memberId: staffMemberId })),
    ).toEqual({ ok: true, data: undefined });
  });

  it("un staff ne peut pas modifier les membres", async () => {
    const owner = await registerOwner();
    const staff = await addMember(owner, owner.orgSlug, "staff");
    const ownerMemberId = await memberIdOf(owner.orgSlug, owner);
    expect(
      await as(staff.headers, () => removeMember(owner.orgSlug, { memberId: ownerMemberId })),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// Isolation multi-tenant des membres
// ---------------------------------------------------------------------------

describe("isolation : un membre de A n'agit jamais sur les membres de B", () => {
  let a: Actor & { orgSlug: string };
  let b: Actor & { orgSlug: string };
  let bStaff: Actor;
  let bStaffMemberId: string;

  beforeAll(async () => {
    a = await registerOwner();
    b = await registerOwner();
    bStaff = await addMember(b, b.orgSlug, "staff");
    bStaffMemberId = await memberIdOf(b.orgSlug, bStaff);
  });

  it("A ne peut pas lister les membres de B", async () => {
    await expect(as(a.headers, () => getOrganizationMembers(b.orgSlug))).rejects.toMatchObject({
      status: 403,
    });
    const membersOfA = await as(a.headers, () => getOrganizationMembers(a.orgSlug));
    expect(membersOfA.map((m) => m.userId)).toEqual([a.userId]);
  });

  it("A ne peut pas modifier un membre de B (ni via B, ni via son propre slug)", async () => {
    expect(
      await as(a.headers, () =>
        updateMemberRole(b.orgSlug, { memberId: bStaffMemberId, role: "manager" }),
      ),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(
      await as(a.headers, () =>
        updateMemberRole(a.orgSlug, { memberId: bStaffMemberId, role: "manager" }),
      ),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("A ne peut pas retirer un membre de B (ni via B, ni via son propre slug)", async () => {
    expect(
      await as(a.headers, () => removeMember(b.orgSlug, { memberId: bStaffMemberId })),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(
      await as(a.headers, () => removeMember(a.orgSlug, { memberId: bStaffMemberId })),
    ).toEqual({ ok: false, error: "NOT_FOUND" });
  });

  it("A ne peut pas inviter dans B", async () => {
    expect(
      await as(a.headers, () =>
        inviteMember(b.orgSlug, { email: `${unique("x")}@example.test`, role: "staff" }),
      ),
    ).toEqual({ ok: false, error: "FORBIDDEN" });
  });

  it("le membre de B est intact", async () => {
    const [row] = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.id, bStaffMemberId));
    expect(row!.role).toBe("staff");
  });
});
