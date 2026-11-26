/**
 * pnpm db:seed : données de développement LOCAL (comptes documentés dans le README).
 * - Atlas Food : un owner, un manager et un staff + 1 restaurant ;
 * - Babel Group : un owner + 1 restaurant (pour vérifier l'isolation à la main).
 * Idempotent : ce qui existe déjà (organisation, compte, appartenance, restaurant) est conservé,
 * seul ce qui manque est ajouté. Refuse toute base non locale. Jamais de données réelles.
 */
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";

import { account, member, organization, restaurants, user } from "../src/lib/db/schema";

import { assertLocalDatabase, connect, loadDatabaseUrl } from "./lib/db";

/** Mot de passe de tous les comptes de démo (10 caractères minimum). */
const DEV_PASSWORD = "password1234";

type SeedMember = { name: string; email: string; role: "owner" | "manager" | "staff" };

const SEED: {
  organization: { name: string; slug: string };
  members: SeedMember[];
  restaurant: {
    name: string;
    slug: string;
    currency: string;
    defaultLocale: string;
    enabledLocales: string[];
  };
}[] = [
  {
    organization: { name: "Atlas Food", slug: "atlas" },
    members: [
      { name: "Owner Atlas", email: "owner@atlas.test", role: "owner" },
      { name: "Manager Atlas", email: "manager@atlas.test", role: "manager" },
      { name: "Staff Atlas", email: "staff@atlas.test", role: "staff" },
    ],
    restaurant: {
      name: "Atlas Marrakech",
      slug: "atlas-marrakech",
      currency: "MAD",
      defaultLocale: "fr",
      enabledLocales: ["fr", "ar", "en"],
    },
  },
  {
    organization: { name: "Babel Group", slug: "babel" },
    members: [{ name: "Owner Babel", email: "owner@babel.test", role: "owner" }],
    restaurant: {
      name: "Babel Paris",
      slug: "babel-paris",
      currency: "EUR",
      defaultLocale: "fr",
      enabledLocales: ["fr", "en"],
    },
  },
];

const url = loadDatabaseUrl();
assertLocalDatabase(url);
const { db, close } = await connect(url);

try {
  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const item of SEED) {
    const now = new Date();

    // Organisation
    let organizationId = (
      await db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, item.organization.slug))
        .limit(1)
    )[0]?.id;
    if (!organizationId) {
      organizationId = crypto.randomUUID();
      await db
        .insert(organization)
        .values({ id: organizationId, ...item.organization, createdAt: now });
    }
    console.log(`${item.organization.name} (/app/${item.organization.slug})`);

    // Comptes et appartenances
    for (const seedMember of item.members) {
      let userId = (
        await db.select({ id: user.id }).from(user).where(eq(user.email, seedMember.email)).limit(1)
      )[0]?.id;
      if (!userId) {
        userId = crypto.randomUUID();
        await db.transaction(async (tx) => {
          await tx.insert(user).values({
            id: userId!,
            name: seedMember.name,
            email: seedMember.email,
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          });
          // Compte "credential" : même format que l'inscription email + mot de passe de Better Auth.
          await tx.insert(account).values({
            id: crypto.randomUUID(),
            accountId: userId!,
            providerId: "credential",
            userId: userId!,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          });
        });
      }

      const isMember = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
        .limit(1);
      if (isMember.length === 0) {
        await db.insert(member).values({
          id: crypto.randomUUID(),
          organizationId,
          userId,
          role: seedMember.role,
          createdAt: now,
        });
      }
      console.log(`  - ${seedMember.role.padEnd(7)} ${seedMember.email} / ${DEV_PASSWORD}`);
    }

    // Restaurant
    const hasRestaurant = await db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(eq(restaurants.slug, item.restaurant.slug))
      .limit(1);
    if (hasRestaurant.length === 0) {
      await db
        .insert(restaurants)
        .values({ organizationId, isPublished: true, ...item.restaurant });
    }
  }
} finally {
  await close();
}
