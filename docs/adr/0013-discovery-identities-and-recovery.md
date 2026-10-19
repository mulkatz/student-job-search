# 0013: discovery identities, provenance and bounded recovery

- Status: accepted
- Date: 2026-10-19

## Context

G4 needs persisted discoveries before matching exists. Source identity does not
prove cross-source identity; a fresh fetch does not prove publication or eligibility.
G3 is incomplete and Brave storage/use remains disabled. ADR 0005 permits bounded
public employer reads absent known conflicting restrictions, not unrestricted reuse.

## Decision

- Validate observations at ingestion. Distinguish search leads, career leads,
  vacancy details and unavailable outcomes; unavailable does not mean closed.
- Identity is the adapter's `(sourceId, sourceRecordId)`. Initially each source
  record has a deterministic canonical job ID. Similar evidenced title/employer
  creates a possible-duplicate link only; no automatic cross-source merge.
  Redirects and query stripping cannot establish a merge or erase source identity.
- Derive immutable revision IDs from normalized meaningful content. Repeated
  observations update check/seen times without duplicating retained revisions. Preserve
  source URL, final URL, evidence URL/quote/selector and source-policy reference.
- Keep first discovery, last observation, successful fetch/check, publication,
  source expiry and retention expiry distinct. Missing source dates stay unknown;
  unknown language/Germany-remote eligibility and unverified application links
  remain explicit. Fit scores are unavailable until G5.
- Use a private local atomic repository for the first bounded operator. Persist
  source cursors with ingestion, reserve each request before dispatch and fence
  every run mutation. Berlin date keys, finite work, overlap denial and interrupted
  recovery apply without installing any cloud schedule. Failures remain source-local.
  Persist cooldowns across days and claim each target/redirect origin for one source;
  other source IDs cannot bypass pacing/backoff. Origin transfer is explicit work.
- Keep shared source facts free of candidate annotations and credentials. A
  shared Firestore projection is separate from owner-private preferences and
  operator state. Only the authenticated API reads shared jobs, enforcing retention;
  direct client reads are denied. It is not another authoritative identity system.
- Private real-source observations and all derived copies have at most seven-day
  retention, with shorter source restrictions taking priority. Filter expired facts
  from reads and provide cleanup. After expiry, recreate a missing current content
  revision only from its freshly retained observation; remove the expired provenance.
  Never imply an open licence or indefinite mirror.
  Synthetic fixtures do not establish source access, useful coverage or permission.

## Alternatives

Title hashes merge unrelated jobs. Fetch timestamps in content hashes create
spurious revisions. In-memory cursors lose recovery. A cloud scheduler/deployment
adds unauthorized infrastructure before the local journey is verified.

## Consequences

The first slice can demonstrate repeat processing with minimized private evidence.
Broad discovery, a second permitted adapter and useful source coverage remain V1
requirements. Profile/package versions and manual application state remain G5/G6.
