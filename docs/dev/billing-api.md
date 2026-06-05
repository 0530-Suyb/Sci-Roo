# Billing API Contract

This document describes the extension-facing website billing API kept in this repository as the future server-backed premium path.

## Current Default Flow

As of June 5, 2026, the extension's active premium flow is:

- local trial
- local activation code entry
- local premium gating

That implementation lives on the extension side and does not require the website billing routes to unlock features.

This document is still important because it defines the contract for the server-backed flow we may reconnect later. Think of it as the handoff target, not the current default runtime path.

## Authentication

All endpoints require the same bearer token already used by Roo Cloud extension APIs:

- Header: `Authorization: Bearer <session-token>`
- Header: `Content-Type: application/json`

## Entitlement Model

Response bodies should match the shared `SubscriptionEntitlement` shape from `packages/types/src/billing.ts`.

```json
{
	"tier": "pro",
	"status": "active",
	"trialStartedAt": "2099-01-01T00:00:00.000Z",
	"trialEndsAt": "2099-01-08T00:00:00.000Z",
	"currentPeriodEndsAt": "2099-02-01T00:00:00.000Z",
	"capabilities": {
		"researchPipeline": true,
		"readPaper": true,
		"paperWriting": true,
		"dataStudio": false
	},
	"upgradeUrl": "https://app.sciroo.com/billing?tier=pro",
	"manageBillingUrl": "https://app.sciroo.com/billing",
	"lastCheckedAt": "2099-01-01T00:00:00.000Z"
}
```

If `capabilities` is omitted, the extension will derive defaults from `tier`, but the backend should prefer returning it explicitly.

## Endpoints

### `GET /api/extension/entitlements`

Returns the current user's active entitlement state.

Use cases:

- extension startup
- auth state refresh
- manual "Refresh Subscription Access"

### `POST /api/extension/trial/start`

Starts a 7-day trial for the current user if they have not used one before.

Returns the updated entitlement object.

Expected behavior:

- idempotent for already-trialing users
- returns the resulting entitlement state, not just a status code

### `POST /api/extension/billing/checkout-session`

Creates a checkout session for one of the paid tiers.

Request:

```json
{
	"tier": "plus"
}
```

Response:

```json
{
	"url": "https://billing.example.com/checkout/session_123"
}
```

Allowed values for `tier`:

- `plus`
- `pro`
- `max`

### `GET /api/extension/billing/portal-url`

Returns the billing portal URL for the current user.

Response:

```json
{
	"url": "https://billing.example.com/portal/session_123"
}
```

## Tier Matrix

- `plus`
    - `researchPipeline`
    - `readPaper`
- `pro`
    - everything in `plus`
    - `paperWriting`
- `max`
    - everything in `pro`
    - `dataStudio`

## Notes

- The extension currently uses a local activation-code flow as the default premium implementation.
- The website billing routes described here are intentionally retained as a scaffold for the future server-backed model.
- The extension currently includes a local fallback trial path for development and degraded-network scenarios.
- Production should rely on backend truth for trial issuance, expiration, upgrades, renewals, and cancellations.
- If billing is unavailable, return a valid entitlement response with `tier: "free"` rather than a partial payload.

## Local Mock

This repository also includes a local mock implementation in `apps/web-roo-code` for developing the server-backed path:

- `GET /api/extension/entitlements`
- `POST /api/extension/trial/start`
- `POST /api/extension/billing/checkout-session`
- `GET /api/extension/billing/portal-url`

The mock is enabled when either condition is true:

- `NODE_ENV=development`
- `SCI_ROO_ENABLE_BILLING_MOCK=true`

The website billing routes also support a provider switch:

- `SCI_ROO_BILLING_PROVIDER=mock`
- `SCI_ROO_BILLING_PROVIDER=real`

The `real` provider now behaves like a production scaffold:

- requires `Authorization: Bearer <token>` by default
- can resolve deterministic entitlements from `SCI_ROO_BILLING_REAL_ENTITLEMENTS_JSON`
- can emit configurable checkout and portal URLs

Environment variables for the scaffold:

- `SCI_ROO_BILLING_REAL_REQUIRE_AUTH=true|false`
- `SCI_ROO_BILLING_REAL_DEFAULT_TIER=free|trial|plus|pro|max`
- `SCI_ROO_BILLING_REAL_ENTITLEMENTS_JSON={"token:abc":{"tier":"pro"}}`
- `SCI_ROO_BILLING_REAL_CHECKOUT_BASE_URL=https://billing.example.com/checkout`
- `SCI_ROO_BILLING_REAL_PORTAL_BASE_URL=https://billing.example.com/portal`

This still is not a full payment backend. It is the integration handoff point for Stripe, webhooks, persistence, and trial bookkeeping.

Mock checkout and portal redirects land on `/billing`.

If you are testing the active plugin-first premium flow, see [docs/dev/billing-local-dev.md](./billing-local-dev.md).
