/**
 * EXCEPTION DOCUMENTÉE à la règle "TenantContext obligatoire" (voir docs/security.md).
 *
 * Le menu public est consulté sans compte (QR code) : il n'y a ni session ni organisation.
 * Pour rester sûr, ce repository est volontairement limité :
 *  - LECTURE SEULE : aucune fonction d'écriture ne doit être ajoutée ici ;
 *  - accès uniquement par slug public ;
 *  - uniquement les restaurants publiés (is_published = true) ;
 *  - sélection explicite des champs PUBLICS (jamais de select() complet, jamais organization_id).
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { restaurants } from "@/lib/db/schema";

export type PublicRestaurant = {
  name: string;
  slug: string;
  currency: string;
  defaultLocale: string;
  enabledLocales: string[];
};

export async function getPublishedRestaurantBySlug(slug: string): Promise<PublicRestaurant | null> {
  const rows = await db
    .select({
      name: restaurants.name,
      slug: restaurants.slug,
      currency: restaurants.currency,
      defaultLocale: restaurants.defaultLocale,
      enabledLocales: restaurants.enabledLocales,
    })
    .from(restaurants)
    .where(and(eq(restaurants.slug, slug), eq(restaurants.isPublished, true)))
    .limit(1);

  return rows[0] ?? null;
}
