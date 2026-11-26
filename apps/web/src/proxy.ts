import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * Proxy Next.js (ex-`middleware.ts`, renommé `proxy.ts` depuis Next 16).
 *
 * 1. Redirige vers /fr les URL sans préfixe de langue.
 * 2. Redirige vers /[locale]/login les espaces /app/* et /admin/* sans cookie de session.
 *
 * ATTENTION : la vérification du cookie est LÉGÈRE (présence seulement, pas de requête en base).
 * Ce n'est PAS un contrôle d'accès : la vraie vérification est faite côté serveur par
 * requireTenant() / requireSuperAdmin() (src/lib/db/tenant.ts) dans chaque page et action.
 */
const PROTECTED_SECTIONS = new Set(["app", "admin"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, firstSegment = "", section = ""] = pathname.split("/");

  if (!isLocale(firstSegment)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  if (PROTECTED_SECTIONS.has(section) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${firstSegment}/login`;
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les routes API, les fichiers internes Next.js et les fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
