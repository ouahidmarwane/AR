import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale, isLocale } from "@/i18n/config";

/**
 * Proxy Next.js (ex-`middleware.ts`, renommé `proxy.ts` depuis Next 16).
 * Pour l'instant : redirige vers /fr les URL sans préfixe de langue.
 * TODO(auth) : appeler updateSession() de @/lib/supabase/middleware.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";

  if (isLocale(firstSegment)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Exclut les routes API, les fichiers internes Next.js et les fichiers statiques.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
