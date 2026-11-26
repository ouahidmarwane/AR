/**
 * pnpm db:seed : données de développement LOCAL.
 * Crée 2 organisations, 1 utilisateur (owner) par organisation et 1 restaurant chacune.
 * Idempotent : une organisation déjà présente (même slug) est ignorée.
 * Ne jamais y mettre de données réelles.
 */
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { account, member, organization, restaurants, user } from "../src/lib/db/schema";

import { assertLocalDatabase, connect, loadDatabaseUrl } from "./lib/db";

const DEV_PASSWORD = "password1234";

const SEED = [
  {
    organization: { name: "Atlas Food", slug: "atlas" },
    owner: { name: "Owner Atlas", email: "owner@atlas.test" },
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
    owner: { name: "Owner Babel", email: "owner@babel.test" },
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
    const existing = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, item.organization.slug))
      .limit(1);
    if (existing.length > 0) {
      console.log(`- ${item.organization.slug} : déjà présent, ignoré.`);
      continue;
    }

    const now = new Date();
    const userId = crypto.randomUUID();
    const organizationId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(user).values({
        id: userId,
        name: item.owner.name,
        email: item.owner.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      // Compte "credential" : même format que l'inscription email + mot de passe de Better Auth.
      await tx.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .insert(organization)
        .values({ id: organizationId, ...item.organization, createdAt: now });
      await tx.insert(member).values({
        id: crypto.randomUUID(),
        organizationId,
        userId,
        role: "owner",
        createdAt: now,
      });
      await tx
        .insert(restaurants)
        .values({ organizationId, isPublished: true, ...item.restaurant });
    });

    console.log(`- ${item.organization.slug} : ${item.owner.email} / ${DEV_PASSWORD}`);
  }
} finally {
  await close();
}
