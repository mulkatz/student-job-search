import { z } from "zod";

export const ownerIdSchema = z
  .string()
  .regex(/^owner_[a-z0-9_]{1,64}$/)
  .brand<"OwnerId">();
export const candidateIdSchema = z
  .string()
  .regex(/^candidate_[a-z0-9_]{1,64}$/)
  .brand<"CandidateId">();

export const privateScopeSchema = z.strictObject({
  ownerId: ownerIdSchema,
  candidateId: candidateIdSchema,
});

export type PrivateScope = z.infer<typeof privateScopeSchema>;

// Compare validated scopes only. A later server must obtain the trusted scope
// from authentication and ownership records, never from untrusted request IDs.
export function assertSamePrivateScope(
  trustedScopeInput: unknown,
  recordScopeInput: unknown,
): PrivateScope {
  const trustedScope = privateScopeSchema.parse(trustedScopeInput);
  const recordScope = privateScopeSchema.parse(recordScopeInput);
  if (
    trustedScope.ownerId !== recordScope.ownerId ||
    trustedScope.candidateId !== recordScope.candidateId
  ) {
    throw new Error("Private record scope mismatch.");
  }
  return recordScope;
}
