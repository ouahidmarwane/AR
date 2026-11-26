/**
 * Rôles d'organisation (voir docs/security.md, "Rôles d'organisation") :
 *  - le créateur d'une organisation reçoit le rôle owner et passe requireTenant(slug, "owner") ;
 *  - seuls owner | manager | staff peuvent être attribués (invitation, ajout, changement de rôle) ;
 *  - un rôle hors liste présent en base ne donne aucun accès.
 *
 * Ces tests passent par la vraie API Better Auth ; seul next/headers est simulé pour
 * fournir à requireTenant() le cookie de session de l'utilisateur.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
}));

import { auth } from "@/lib/auth/server";
import { parseOrgRoles } from "@/lib/auth/permissions";
import { pool } from "@/lib/db/client";
import { member } from "@/lib/db/schema";
import { db } from "@/lib/db/client";
import { requireTenant, resolveTenant } from "@/lib/db/tenant";
import { ForbiddenError } from "@/lib/errors";

/** Erreur levée par les hooks de src/lib/auth/server.ts (et non une autre erreur). */
const ROLE_REJECTED = /Rôle invalide/;

/**
 * Les types de Better Auth n'acceptent déjà que owner | manager | staff : on force
 * volontairement un rôle invalide pour vérifier le rejet à l'exécution (appel non typé, ex. HTTP).
 */
const invalidRole = (role: string) => role as unknown as "staff";

let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

/** Inscrit un utilisateur et renvoie son id et les headers de sa session (cookie). */
async function signUp() {
  const email = `${unique("user")}@example.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: "password1234", name: "Test user" },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return { userId: response.user.id, email, headers: new Headers({ cookie }) };
}

let owner: Awaited<ReturnType<typeof signUp>>;
let orgSlug: string;
let organizationId: string;

beforeAll(async () => {
  owner = await signUp();
  orgSlug = unique("org");
  const organization = await auth.api.createOrganization({
    body: { name: "Org rôles", slug: orgSlug },
    headers: owner.headers,
  });
  organizationId = organization!.id;
});

afterAll(async () => {
  await pool.end();
});

describe("créateur d'une organisation", () => {
  it("reçoit le rôle owner et passe requireTenant(orgSlug, 'owner')", async () => {
    request.headers = owner.headers;
    await expect(requireTenant(orgSlug, "owner")).resolves.toEqual({
      organizationId,
      userId: owner.userId,
      role: "owner",
    });
  });

  it("requireTenant échoue sans session", async () => {
    request.headers = new Headers();
    await expect(requireTenant(orgSlug)).rejects.toMatchObject({ status: 401 });
  });
});

describe("attribution des rôles", () => {
  it.each(["member", "admin", "superuser", "", "owner,member"])(
    "addMember refuse le rôle %j",
    async (role) => {
      const other = await signUp();
      await expect(
        auth.api.addMember({
          body: { userId: other.userId, role: invalidRole(role), organizationId },
        }),
      ).rejects.toThrow(ROLE_REJECTED);
      await expect(resolveTenant(other.userId, orgSlug)).rejects.toBeInstanceOf(ForbiddenError);
    },
  );

  it("addMember accepte manager, avec les droits correspondants", async () => {
    const other = await signUp();
    await auth.api.addMember({ body: { userId: other.userId, role: "manager", organizationId } });

    await expect(resolveTenant(other.userId, orgSlug, "manager")).resolves.toMatchObject({
      role: "manager",
    });
    await expect(resolveTenant(other.userId, orgSlug, "owner")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("createInvitation refuse member et accepte staff", async () => {
    await expect(
      auth.api.createInvitation({
        body: {
          email: `${unique("invite")}@example.test`,
          role: invalidRole("member"),
          organizationId,
        },
        headers: owner.headers,
      }),
    ).rejects.toThrow(ROLE_REJECTED);

    await expect(
      auth.api.createInvitation({
        body: { email: `${unique("invite")}@example.test`, role: "staff", organizationId },
        headers: owner.headers,
      }),
    ).resolves.toMatchObject({ role: "staff" });
  });

  it("updateMemberRole refuse member", async () => {
    const other = await signUp();
    const added = await auth.api.addMember({
      body: { userId: other.userId, role: "staff", organizationId },
    });

    await expect(
      auth.api.updateMemberRole({
        body: { memberId: added!.id, role: "member", organizationId },
        headers: owner.headers,
      }),
    ).rejects.toThrow(ROLE_REJECTED);
  });

  it("un rôle hors liste écrit directement en base ne donne aucun accès", async () => {
    const other = await signUp();
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId,
      userId: other.userId,
      role: "member",
      createdAt: new Date(),
    });
    await expect(resolveTenant(other.userId, orgSlug)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("parseOrgRoles", () => {
  it("n'accepte que owner | manager | staff", () => {
    expect(parseOrgRoles("owner")).toEqual(["owner"]);
    expect(parseOrgRoles("manager,staff")).toEqual(["manager", "staff"]);
    expect(parseOrgRoles(["staff"])).toEqual(["staff"]);
    for (const invalid of ["member", "admin", "", " ", "owner,member", [], undefined, null, 3]) {
      expect(parseOrgRoles(invalid)).toBeNull();
    }
  });
});
