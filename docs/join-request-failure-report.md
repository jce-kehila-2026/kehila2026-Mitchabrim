# Join request failure – analysis and fix

Date: 2026-07-27

## Symptom

Submitting the public join form always displayed the generic Hebrew rejection message:

> לא ניתן לשלוח את הפנייה כרגע. אנא בדקו את הפרטים ונסו שוב מאוחר יותר.

The same behavior occurred in local development and in the deployed site, while
the browser console contained no uncaught error.

## Root cause

`createJoinRequest` refused to call the Firebase callable function unless
`VITE_FIREBASE_APPCHECK_SITE_KEY` existed. The active local build environment
does not define that variable, and Vite embeds the same missing value into the
production bundle at build time.

The service deliberately threw `app-check-not-configured` before making any
network request. `JoinRequestSection` caught that exception and converted it to
the generic rejection banner. Because the exception was handled, the browser
reported no uncaught console error. The deployed `submitJoinRequest` function
itself was active in `us-central1`, and its `JOIN_REQUEST_HASH_PEPPER` secret was
configured, so neither was the source of the failure.

## Fix

The public join callable is now independent of App Check:

- The client always initializes the `us-central1` Functions client and invokes
  `submitJoinRequest`.
- The public callable no longer enforces or consumes an App Check token.
- App Check remains mandatory for authenticated administrative mutations via
  the separate `getSecureFunctions` path.
- `allowedUsersService` was moved explicitly to that protected path.

The public endpoint is still protected against abuse by server-side validation,
an HMAC-protected idempotency key, semantic duplicate detection, per-IP and
per-phone rate limits, and atomic Firestore writes. Direct public Firestore
writes remain denied by the security rules.

## Verification

- Security regression suite verifies that the public callable does not depend
  on App Check while protected callables still do.
- The suite verifies input validation, Firestore write denial, atomic request
  and notification creation, idempotency, duplicate suppression, and rate
  limiting.
- The production build verifies that the corrected client compiles.

## Deployment note

Both Hosting and the `submitJoinRequest` function must be deployed together.
Deploying only Hosting would reach the previously App-Check-enforced function;
deploying only the function would leave the old client-side preflight rejection.
