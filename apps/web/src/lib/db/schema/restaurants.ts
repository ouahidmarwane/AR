import { boolean, char, index, json, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { organization } from "./auth";

/**
 * Restaurants d'une organisation.
 * Toute table métier porte un organization_id NOT NULL : c'est la clé de
 * l'isolation multi-tenant appliquée par src/lib/db/tenant.ts (voir docs/security.md).
 */
export const restaurants = mysqlTable(
  "restaurants",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: varchar("organization_id", { length: 36 })
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 191 }).notNull(),
    /** Identifiant public dans l'URL du menu : /[locale]/m/[slug]. */
    slug: varchar("slug", { length: 191 }).notNull().unique(),
    /** Code ISO 4217 (MAD, EUR...). */
    currency: char("currency", { length: 3 }).notNull(),
    defaultLocale: varchar("default_locale", { length: 5 }).notNull().default("fr"),
    enabledLocales: json("enabled_locales")
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => ["fr"]),
    /** Seuls les restaurants publiés sont visibles sur le menu public. */
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
    // Mis à jour par Drizzle à chaque update ($onUpdate) : MySQL refuse
    // ON UPDATE CURRENT_TIMESTAMP sur un timestamp(3) avec DEFAULT (now()).
    updatedAt: timestamp("updated_at", { fsp: 3 })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("restaurants_organization_id_idx").on(table.organizationId)],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type NewRestaurant = typeof restaurants.$inferInsert;
