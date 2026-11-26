"use client";

import { inferAdditionalFields, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { auth } from "./server";
import { ac, roles } from "./permissions";

/** Client Better Auth pour les composants React ("use client"). Même origine que l'API. */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), organizationClient({ ac, roles })],
});

export const { signIn, signUp, signOut, useSession } = authClient;
