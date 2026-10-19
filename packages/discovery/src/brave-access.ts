import { z } from "zod";

/** Operator authorization records a private-use instruction, not a provider grant. */
export const braveAccessSchema = z.strictObject({
  operatorAuthorizationRef: z.string().trim().min(1).max(1000),
  providerGrant: z.literal("unverified"),
  decisionRef: z.literal(
    "docs/adr/0016-private-brave-operator-authorization.md",
  ),
  purpose: z.literal("bounded_private_discovery"),
  retain: z.literal("urls_and_provenance_only"),
  expiresAt: z.iso.datetime({ offset: true }),
});
export type BraveAccess = z.infer<typeof braveAccessSchema>;
