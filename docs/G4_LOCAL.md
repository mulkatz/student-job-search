# G4 local authenticated discovery

This preview uses a demo Firebase project and loopback Auth, Firestore and Storage
emulators. It cannot deploy or fall through to Application Default Credentials.
The browser uses temporary anonymous synthetic identities, not a production Google
login. No Gmail scope, mailbox, application draft, upload or send action exists.
Real profile processing and upload lifecycle remain G5 work; package copying is G6.

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
first; scores stay null/unavailable until G5. The original source remains visible;
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
separate operator cleanup requirements; this command covers only the read projection.

Owner-private documents use `users/{verifiedUid}/preferences/discovery`.
`POST /api/demo/preferences` creates only the synthetic marker and accepts no body;
`GET /api/preferences` reads only the verified token owner's document. Stored owner
IDs must match that derived owner. No client-supplied owner routes are supported.
Firestore rules independently allow owner-only private reads and reject all client
writes. Storage paths `users/{verifiedUid}/**` allow owner-only reads and reject all
client writes. There is no Storage download or upload API in G4. Synthetic rule
fixtures do not establish a production CV lifecycle or authorize real data.

Retention enforcement here is read expiry plus explicitly invoked physical deletion
of the shared projection. Owner export/deletion and production retention operations
are still required before
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
