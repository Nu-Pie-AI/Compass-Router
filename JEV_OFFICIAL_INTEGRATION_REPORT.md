# Jev Official Integration Report

Status: integrated but disabled by default.

Compass Router now has an official TypeSafe AI provider record, `typesafe_decision` adapter protocol, typed Decision API, and Decision Workspace. Human authentication, organization membership, project scope, assigned Compass key checks, rate limits, wallet accounting, and request records reuse the existing Compass paths.

The official SDK is `typesafe-sdk==0.7.4`. Jev execution is server-side only through the SDK; no TypeSafe key is exposed to the browser. Saving a platform TypeSafe key does not enable the provider or model.

Jev remains unavailable until all of the following are explicitly configured and reviewed: `TYPESAFE_ENABLED=true`, a valid credential with model access, provider commercial approval, and approved Compass pricing. The default seeded model is unpublished and unavailable.

API: `POST /member/v1/decisions`. Authentication uses the Clerk session plus `X-Compass-Key-Id` and `X-Compass-Project-Id`; the body contains `state` and typed `questions`. Chat endpoints are unchanged.

No live inference, paid request, migration, deployment, or Marketplace publication was performed.
