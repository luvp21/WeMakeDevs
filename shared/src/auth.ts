import { z } from "zod";

// Who is signed in. A tester is a shared demo account (one render, then done);
// the judge sees every project from every account.
export const AuthRoleSchema = z.enum(["tester", "judge"]);
export type AuthRole = z.infer<typeof AuthRoleSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UsageSchema = z.object({
  drafts: z.number().int().nonnegative(),
  locks: z.number().int().nonnegative(),
  renders: z.number().int().nonnegative(),
});
export type Usage = z.infer<typeof UsageSchema>;

// What a tester may do in total. Rendering is the expensive step (Fargate), so
// it is strict; drafts and locks only bound the model spend.
export const LimitsSchema = UsageSchema;
export type Limits = z.infer<typeof LimitsSchema>;

export const SessionSchema = z.object({
  username: z.string(),
  display_name: z.string(),
  role: AuthRoleSchema,
  // Present for testers; a judge has no limits.
  usage: UsageSchema.optional(),
  limits: LimitsSchema.optional(),
});
export type Session = z.infer<typeof SessionSchema>;

export const LoginResponseSchema = SessionSchema.extend({
  token: z.string(),
  expires_at: z.string(),
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const TESTER_LIMITS: Limits = { drafts: 5, locks: 3, renders: 1 };

// The private judge link carries a long key; opening it signs the judge in.
export const JudgeLinkRequestSchema = z.object({
  key: z.string().min(20).max(200),
});
export type JudgeLinkRequest = z.infer<typeof JudgeLinkRequestSchema>;
