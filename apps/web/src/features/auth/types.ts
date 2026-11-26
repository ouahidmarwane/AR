import type { ActionResult, CommonActionError } from "@/lib/actions";

export type {
  RequestPasswordResetInput,
  ResetPasswordInput,
  SendVerificationEmailInput,
  SignInInput,
  SignUpInput,
} from "./schemas";

/** Codes d'erreur des actions d'authentification (à traduire côté front). */
export type SignUpError = CommonActionError | "EMAIL_UNAVAILABLE" | "SLUG_TAKEN";
/** Toujours générique : ne révèle jamais si l'email existe. */
export type SignInError = CommonActionError | "INVALID_CREDENTIALS";
export type ResetPasswordError = CommonActionError | "INVALID_TOKEN";
export type SendVerificationEmailError = CommonActionError | "ALREADY_VERIFIED";

export type SignUpResult = ActionResult<{ organizationSlug: string }, SignUpError>;
export type SignInResult = ActionResult<{ organizationSlug: string | null }, SignInError>;
export type SignOutResult = ActionResult<void, never>;
export type RequestPasswordResetResult = ActionResult<void, CommonActionError>;
export type ResetPasswordResult = ActionResult<void, ResetPasswordError>;
export type SendVerificationEmailResult = ActionResult<void, SendVerificationEmailError>;

/** Utilisateur connecté, tel qu'exposé au front. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
};
