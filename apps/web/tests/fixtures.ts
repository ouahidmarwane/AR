/**
 * Fabriques de données pour les tests (accès direct à la base autorisé hors de src/).
 */
import { db } from "@/lib/db/client";
import { member, organization, restaurants, user } from "@/lib/db/schema";
import type { Role } from "@/lib/db/tenant";

let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

/** Crée une organisation, son membre (rôle donné) et un restaurant. */
export async function createTenantFixture(role: Role = "owner") {
  const now = new Date();
  const userId = crypto.randomUUID();
  const organizationId = crypto.randomUUID();
  const restaurantId = crypto.randomUUID();
  const orgSlug = unique("org");

  await db.insert(user).values({
    id: userId,
    name: "Test user",
    email: `${unique("user")}@example.test`,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values({
    id: organizationId,
    name: `Org ${orgSlug}`,
    slug: orgSlug,
    createdAt: now,
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId,
    role,
    createdAt: now,
  });
  await db.insert(restaurants).values({
    id: restaurantId,
    organizationId,
    name: `Restaurant ${orgSlug}`,
    slug: unique("restaurant"),
    currency: "MAD",
  });

  return { userId, organizationId, orgSlug, restaurantId };
}
