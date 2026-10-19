# 0014: local Firebase discovery authentication and ownership

- Status: accepted
- Date: 2026-10-19

## Context

G4 needs an authenticated browser journey and independently tested owner isolation.
G2's branded synthetic owner IDs are not Firebase authentication or authorization.
No deployment, production provisioning or real candidate processing is requested.

## Decision

- Add a minimal React/Vite table and Node API using maintained Firebase client
  and Admin SDKs. Use Firebase Auth, Firestore and Storage emulators with a fixed
  non-production `demo-` project for local execution; fail closed rather than
  silently falling back to ADC or a production service.
- Verify Firebase ID tokens server-side. Derive private paths from verified UID,
  never a request's owner ID. A Firebase UID is a separate authentication identifier
  from G2's branded offline owner ID; do not coerce or pretend they are equivalent.
- Keep operator source state outside browser access. Private owner records
  contain no other owner's data. Deny anonymous and cross-owner private access
  in Firestore and Storage rules; all client writes and direct shared-job reads
  are denied. The API filters shared source facts for retention expiry.
- Use synthetic identities and data for local tests. Test the real emulator SDK,
  API token boundary, cross-owner denial, invalid/expired authentication and rules.
  No CV upload or real private candidate record is enabled by this slice.
- Render source strings as text; validate links, permit no untrusted HTML or
  executable schemes. Original posting links and evidence remain reviewable;
  fit scores are unavailable and application-package actions wait for G6.
- Exercise the local journey in a real browser and include emulator/browser
  checks in the integrated gate. Tests do not call paid or production providers.

## Alternatives

Fake authentication would not test ownership. Cloud deployment is outside scope.
A custom token protocol adds maintenance and risk without a product benefit.

## Consequences and sources

Local verified authentication does not prove deployed identity-provider setup,
production recovery, privacy operations or useful live discovery coverage.
Current packages are pinned in the lockfile after registry review (2026-10-19).
Official references reviewed on that date: [Auth emulator](https://firebase.google.com/docs/emulator-suite/connect_auth),
[ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens),
[rules tests](https://firebase.google.com/docs/rules/unit-tests),
[emulator setup](https://firebase.google.com/docs/emulator-suite/install_and_configure).
