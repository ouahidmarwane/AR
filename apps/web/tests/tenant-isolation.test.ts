/**
 * Tests d'isolation multi-tenant (OBLIGATOIRES pour chaque repository, voir docs/security.md).
 * Deux organisations A et B ont chacune un restaurant : A ne doit JAMAIS voir les données de B.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getRestaurant, listRestaurants } from "@/features/restaurants/repository";
import { pool } from "@/lib/db/client";
import { assertSameTenant, resolveTenant, type TenantContext } from "@/lib/db/tenant";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

import { createTenantFixture } from "./fixtures";

type Fixture = Awaited<ReturnType<typeof createTenantFixture>>;

let a: Fixture;
let b: Fixture;
let ctxA: TenantContext;

beforeAll(async () => {
  a = await createTenantFixture("owner");
  b = await createTenantFixture("owner");
  ctxA = await resolveTenant(a.userId, a.orgSlug);
});

afterAll(async () => {
  await pool.end();
});

describe("resolveTenant", () => {
  it("construit le contexte depuis la table member", () => {
    expect(ctxA).toEqual({ organizationId: a.organizationId, userId: a.userId, role: "owner" });
  });

  it("refuse un utilisateur de A sur l'organisation B", async () => {
    await expect(resolveTenant(a.userId, b.orgSlug)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuse une organisation inexistante avec la même erreur", async () => {
    await expect(resolveTenant(a.userId, "org-inexistante")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("refuse un rôle insuffisant", async () => {
    const staff = await createTenantFixture("staff");
    await expect(resolveTenant(staff.userId, staff.orgSlug, "manager")).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(resolveTenant(staff.userId, staff.orgSlug, "staff")).resolves.toMatchObject({
      role: "staff",
    });
  });
});

describe("restaurants repository", () => {
  it("listRestaurants(A) ne renvoie que les restaurants de A", async () => {
    const list = await listRestaurants(ctxA);

    expect(list.map((r) => r.id)).toEqual([a.restaurantId]);
    expect(list.every((r) => r.organizationId === a.organizationId)).toBe(true);
    expect(list.some((r) => r.id === b.restaurantId)).toBe(false);
  });

  it("getRestaurant(A, id de A) renvoie le restaurant", async () => {
    const restaurant = await getRestaurant(ctxA, a.restaurantId);
    expect(restaurant.id).toBe(a.restaurantId);
  });

  it("getRestaurant(A, id de B) échoue", async () => {
    await expect(getRestaurant(ctxA, b.restaurantId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("un contexte forgé avec l'organisation de B ne donne pas accès via un autre userId", async () => {
    // Le contexte ne doit venir que de resolveTenant/requireTenant : ce test documente
    // qu'on ne peut pas l'obtenir pour B avec l'utilisateur de A.
    await expect(resolveTenant(a.userId, b.orgSlug, "staff")).rejects.toThrow();
  });
});

describe("assertSameTenant", () => {
  it("rejette une ligne d'une autre organisation", () => {
    expect(() => assertSameTenant({ organizationId: b.organizationId }, ctxA)).toThrow(
      ForbiddenError,
    );
    expect(() => assertSameTenant(null, ctxA)).toThrow(ForbiddenError);
    expect(() => assertSameTenant({ organizationId: a.organizationId }, ctxA)).not.toThrow();
  });
});
