export type SessionUser = { subject: string; email: string; emailVerified: boolean };

export type CreateUserResult =
  | { ok: true; subject: string }
  | { ok: false; reason: "exists" | "weak_password" | "error"; message?: string };

/**
 * Identity boundary. Production uses Supabase Auth (maintained password
 * hashing, sessions, token generation). The local adapter exists only for
 * development and automated tests and is refused by production config.
 */
export interface AuthProvider {
  getSessionUser(): Promise<SessionUser | null>;
  /** Establishes a session; returns the provider subject or null. */
  signIn(email: string, password: string): Promise<string | null>;
  signOut(scope: "local" | "others"): Promise<void>;
  /** Creates a confirmed user (mailbox control was proven by an invitation link). */
  createConfirmedUser(email: string, password: string): Promise<CreateUserResult>;
  /** Returns a single-use hashed token for a recovery link, or null if no such user. */
  generateRecoveryToken(email: string): Promise<string | null>;
  /** Returns a single-use hashed token sent to newEmail to confirm a change. */
  generateEmailChangeToken(currentEmail: string, newEmail: string): Promise<string | null>;
  /** Verifies a token and establishes a session for its user. */
  verifyToken(type: "recovery" | "email_change", tokenHash: string): Promise<boolean>;
  updatePassword(newPassword: string): Promise<{ ok: true } | { ok: false; message: string }>;
}

export const PASSWORD_MIN = 10;
