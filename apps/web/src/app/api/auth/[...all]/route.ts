import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/server";

// Toutes les routes Better Auth : /api/auth/sign-in/email, /api/auth/organization/..., etc.
export const { GET, POST } = toNextJsHandler(auth);
