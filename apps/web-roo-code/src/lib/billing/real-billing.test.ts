import { afterEach, describe, expect, it, vi } from "vitest"

import {
	REAL_BILLING_CHECKOUT_BASE_URL_ENV_VAR,
	REAL_BILLING_DEFAULT_TIER_ENV_VAR,
	REAL_BILLING_ENTITLEMENTS_ENV_VAR,
	REAL_BILLING_PORTAL_BASE_URL_ENV_VAR,
	REAL_BILLING_REQUIRE_AUTH_ENV_VAR,
	realBillingService,
} from "./real-billing"
import type { BillingRouteContext } from "./types"

function createRouteContext(
	headers: Record<string, string> = {},
	baseUrl = "https://billing.sci-roo.dev",
): BillingRouteContext {
	return {
		baseUrl,
		requestUrl: new URL(`${baseUrl}/api/extension/entitlements`),
		requestHeaders: new Headers(headers),
	}
}

describe("real billing service", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("requires auth by default", async () => {
		await expect(realBillingService.getEntitlement(createRouteContext())).rejects.toMatchObject({
			status: 401,
		})
	})

	it("resolves tier overrides from bearer-token keyed config", async () => {
		vi.stubEnv(
			REAL_BILLING_ENTITLEMENTS_ENV_VAR,
			JSON.stringify({
				"token:pro-user-token": {
					tier: "pro",
					status: "active",
				},
			}),
		)

		const entitlement = await realBillingService.getEntitlement(
			createRouteContext({
				authorization: "Bearer pro-user-token",
			}),
		)

		expect(entitlement.tier).toBe("pro")
		expect(entitlement.capabilities.paperWriting).toBe(true)
		expect(entitlement.capabilities.dataStudio).toBe(false)
		expect(entitlement.manageBillingUrl).toBe("https://billing.sci-roo.dev/billing?source=extension-portal")
	})

	it("falls back to the configured default tier when no override exists", async () => {
		vi.stubEnv(REAL_BILLING_DEFAULT_TIER_ENV_VAR, "plus")

		const entitlement = await realBillingService.getEntitlement(
			createRouteContext({
				authorization: "Bearer someone-else",
			}),
		)

		expect(entitlement.tier).toBe("plus")
		expect(entitlement.capabilities.readPaper).toBe(true)
		expect(entitlement.capabilities.paperWriting).toBe(false)
	})

	it("starts a trial for free users and respects trialEligible=false", async () => {
		vi.stubEnv(
			REAL_BILLING_ENTITLEMENTS_ENV_VAR,
			JSON.stringify({
				"token:free-user": {
					tier: "free",
				},
				"user:no-trial-user": {
					tier: "free",
					trialEligible: false,
				},
			}),
		)

		const trialEntitlement = await realBillingService.startTrial(
			createRouteContext({
				authorization: "Bearer free-user",
			}),
		)
		const blockedEntitlement = await realBillingService.startTrial(
			createRouteContext({
				"x-sci-roo-user-id": "no-trial-user",
			}),
		)

		expect(trialEntitlement.tier).toBe("trial")
		expect(trialEntitlement.status).toBe("trialing")
		expect(blockedEntitlement.tier).toBe("free")
		expect(blockedEntitlement.status).toBe("free")
	})

	it("uses configured checkout and portal URLs", async () => {
		vi.stubEnv(REAL_BILLING_CHECKOUT_BASE_URL_ENV_VAR, "https://payments.sci-roo.dev/checkout")
		vi.stubEnv(REAL_BILLING_PORTAL_BASE_URL_ENV_VAR, "https://payments.sci-roo.dev/portal")

		const checkout = await realBillingService.createCheckoutSession({
			tier: "max",
			...createRouteContext({
				authorization: "Bearer paid-user",
			}),
		})
		const portal = await realBillingService.getBillingPortalUrl(
			createRouteContext({
				authorization: "Bearer paid-user",
			}),
		)

		expect(checkout.url).toBe("https://payments.sci-roo.dev/checkout?tier=max")
		expect(portal.url).toBe("https://payments.sci-roo.dev/portal")
	})

	it("can operate without auth when explicitly disabled", async () => {
		vi.stubEnv(REAL_BILLING_REQUIRE_AUTH_ENV_VAR, "false")
		vi.stubEnv(REAL_BILLING_DEFAULT_TIER_ENV_VAR, "pro")

		const entitlement = await realBillingService.getEntitlement(createRouteContext())

		expect(entitlement.tier).toBe("pro")
		expect(entitlement.capabilities.paperWriting).toBe(true)
	})
})
