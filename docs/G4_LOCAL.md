# G4 local authenticated discovery

This preview uses a demo Firebase project and loopback Auth, Firestore and Storage
emulators. It cannot deploy or fall through to Application Default Credentials.
The browser uses temporary anonymous synthetic identities, not a production Google
login. Gmail/mailbox and application sending remain outside this preview. G5 adds
local synthetic PDF upload, approved profiles, matching and private lifecycle;
real CV use is not authorized. Application package copying remains G6.

## Run the synthetic journey

Use the pinned Node/npm runtime from the repository README, then:

```sh
npm ci
npm run build
npm run local:emulators
```

In a second terminal, set all three explicit loopback targets before seeding/starting
the API. These values identify local processes, not provider accounts:

```sh
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
npm run seed --workspace=@job-search/server
npm run start --workspace=@job-search/server
```

In another terminal run `npm run dev --workspace=@job-search/web`, then open
<http://127.0.0.1:5173>. Use **Sign in to local demo**, expand **Evidence & details**,
and sign out. The seeded vacancy and its `.example` links are synthetic. Do not
use those links as actual application channels. No browser fields need writing.
The browser identity stays in memory; refreshing creates no persistent user session.
Stop these processes to end the local preview. Emulator data is ephemeral unless
an operator independently exports it; no export is configured here.

## Data and authorization contracts

`GET /api/jobs` requires a Firebase ID token verified by the Admin SDK with revoked/
disabled-user checking. It returns at most 100 schema-validated shared projections,
excluding observations at or after `retentionUntil` before the bounded query limit. Newest `lastCheckedAt` comes
first. Without a current approved profile evaluation, scores stay unavailable.
G5 adds private profile-bound evaluations without changing shared records.
The original source remains visible;
source-listed application links are unverified and show their evidence. Email
addresses appear as text for manual use; no compose/form action is triggered.

Shared projections live at `sharedJobs/{jobId}`, with a server-derived numeric
`retentionUntilEpochMs` query field checked against the observation timestamp. Clients cannot read or write them
directly: API reads enforce retention. `persistSharedJobs` is the bounded,
schema-validated server import boundary used by the synthetic seed and an explicitly
local operator. It accepts only shared discovery records, not candidate annotations.
No live source is automatically polled or imported by this UI. Source provenance,
policy references, immutable revision history and run diagnostics are managed by
the discovery repository; this Firestore collection is a current read projection.
Expired projections are hidden. With the same explicit emulator environment,
`npm run cleanup --workspace=@job-search/server` physically deletes at most 100 expired
read projections per invocation. Repeat if it reports a full batch. Deletions carry
update-time preconditions so concurrent refreshes cannot silently be removed. No
background cleanup is installed. Raw captures and discovery repository history have
separate operator cleanup requirements. G5 additionally processes at most 25 due
private profile records per invocation; repeat a full batch. Ambiguous upload markers
remain blocked until terminal-write evidence permits physical reconciliation.

Owner-private documents use `users/{verifiedUid}/preferences/discovery`.
`POST /api/demo/preferences` creates only the synthetic marker and accepts no body;
`GET /api/preferences` reads only the verified token owner's document. Stored owner
IDs must match that derived owner. No client-supplied owner routes are supported.
Firestore rules independently allow owner-only preference reads and reject all
client writes. G5 profile state and its Storage prefix deny direct SDK access;
authenticated API boundaries enforce owner, lifecycle and expiry. G4 itself had no
Storage upload API; G5 adds synthetic PDF upload/export through the local API.
Synthetic rule fixtures do not establish a production CV lifecycle or authorize real data.

Retention enforcement here is read expiry plus explicitly invoked physical deletion
of the shared projection. G5 adds local owner export/deletion and bounded private
retention; production operations and real-data authorization remain separate before
real candidate data and V1 release. Shared job records contain no owner preferences,
credentials, candidate facts or application annotations.

## Verification

- `npm run test --workspace=@job-search/server`: offline API authentication/scope and
  emulator-only configuration failures.
- `npm run test:emulators`: real local Auth token verification, two-owner API isolation,
  Firestore and private Storage rules, unauthenticated/cross-owner denial, disabled,
  expired and malformed tokens, expired job suppression before query limits, bounded physical cleanup and corrupted-owner rejection.
- `npm run test:browser`: Playwright Chromium opens the local app, signs in through the
  real Auth emulator SDK, checks evidence/unknowns/original links and signs out.
  It starts the seed/API/Vite inside the emulator command. Install Chromium once with
  `npx playwright install chromium` if absent. Browser tests never open application links.
- `npm run verify`: the integrated repository gate, including these local checks.

These establish a local synthetic journey and ownership boundary. They do not prove
live source permissions, useful discovery coverage, production authentication,
scheduled deletion, full data lifecycle or G4/V1 completion.

Dependency and provider references reviewed 2026-10-19: versions were read from the
official npm registry and pinned in workspace manifests/lockfile. Firebase behavior
follows [Auth emulator connection](https://firebase.google.com/docs/emulator-suite/connect_auth),
[Admin SDK setup](https://firebase.google.com/docs/admin/setup), and
[Security Rules testing](https://firebase.google.com/docs/rules/unit-tests).
Emulator ID tokens are unsigned local test tokens and must never be accepted by a
production server; the server requires all three exact emulator hosts before startup.

## Dependency audit limitation

The 2026-10-19 install audit reports seven vulnerable dependency nodes (four
moderate, three high), all under the current `firebase-tools` development CLI.
The high path is `firebase-tools -> chokidar -> braces <=3.0.3`; the registry's
current braces release is 3.0.3, so no supported patched release was available.
Moderate paths include OpenTelemetry core 1.x and gaxios/uuid 9.x. No automatic
major dependency overrides or audit suppression are applied to these CLI paths.
Keep emulators local and revisit upstream fixes before deployment tooling is used.
The application SDK's Node gRPC path is explicitly overridden to 1.14.6 to remove
its older affected resolution; the actual SDK/emulator tests exercise this version.
The pinned npm `ls` command still labels Firestore's original `~1.9.0` edge invalid
against that deliberate override; clean `npm ci` succeeds. Neither `npm audit` nor
`npm ls` is claimed to pass. The integrated behavior gate remains separate.

## Explicit private source projection and browser proof

After building, a separate opt-in path imports a minimized private JSON array of
1–100 current `DiscoveryJob` projections into the same local emulators:

```sh
npm run seed --workspace=@job-search/server -- --file .local/g4/private-proof/jobs.json
```

Use the three emulator environment variables above. The importer requires a
regular, single-link file with mode `0600`, private `0700` directories under the
repository's `.local/`, at most 4 MiB, strict schemas, matching job/revision IDs,
valid observation chronology and unexpired retention. It rejects symlink paths,
private candidate annotations and malformed records without echoing their content.
These checks validate the import boundary; they do not prove source authenticity.

To exercise an explicitly supplied actual-source projection in Chromium:

```sh
G4_SOURCE_FIXTURE_PATH=.local/g4/private-proof/jobs.json npm run test:browser
```

The optional journey requires an evidenced, non-synthetic vacancy detail, signs in
through the local demo button, checks exact source content, lineage, unknowns and
null fit, then signs out. External browser requests are blocked; no source link or
application form is opened. Bind the private fixture to the independently reviewed
source/operator hashes before claiming actual-source evidence. Without the variable,
the default integrated gate continues to use only synthetic data and no provider API.

## Bounded search and traversal

[ADR 0015](adr/0015-expiring-discovery-frontiers.md) defines expiring discovery
frontiers and [ADR 0016](adr/0016-private-brave-operator-authorization.md) records the
user's explicit bounded private Brave exception despite an unverified provider
grant. These are separate authorization facts. The fixed-endpoint adapter requires
explicit live opt-in, a frozen query manifest, private credentials, independent
accounting hooks and finite run bounds. It retains URL/provenance only; snippets,
provider titles and raw responses are discarded. Search leads are not fetched jobs.

Pass search and lazy career traversal adapters together in their frozen daily order.
The traversal frontier initializes once after earlier observations commit and before
its first HTTP request. A checkpoint's URLs/provenance expire within parent/source
retention; cursors contain opaque tokens. Per-hop source policy, public DNS/address
validation, redirect controls, origin ownership and persisted pacing remain active.
Known restrictions and actual access challenges stop the affected fetch. Bounds,
truncation, unavailable pages and unfinished checkpoints remain visible in run state.
See the [package API and recovery instructions](../packages/discovery/README.md).

A paid attempt marker is written before the external ledger/dispatch hook and cleared
only with the atomic observation/cursor commit. A timeout, uncertain response or
cross-store interruption requires exact-token reconciliation after stopping the old
worker. Never delete markers, locks, reservations or old results to repeat a charge.
The existing G3 ledger remains authoritative for cumulative caps and costs; its first
actual discovery dispatch remains preserved. ADR 0017 subsequently replaced the
mandatory seven-day G3/A duration with a bounded snapshot. G3 remediation preserves the original negative investigation; one observed live date,
repeat processing and offline calendar
tests do not establish recurring market yield or V1 acceptance, production
authentication or cloud scheduling.
