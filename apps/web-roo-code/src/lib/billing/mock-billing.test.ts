import { describe, expect, it, vi, afterEach } from "vitest"

import {
	buildMockCheckoutUrl,
	buildMockEntitlement,
	buildMockPortalUrl,
	isBillingMockEnabled,
	parseBillingMockTier,
} from "./mock-billing"

describe("mock billing helpers", () => {
	afterEach(() => {
		delete process.env.SCI_ROO_ENABLE_BILLING_MOCK
		vi.unstubAllEnvs()
	})

	it("parses supported tiers and falls back to free", () => {
		expect(parseBillingMockTier("plus")).toBe("plus")
		expect(parseBillingMockTier("max")).toBe("max")
		expect(parseBillingMockTier("anything-else")).toBe("free")
	})

	it("builds tier-aware mock entitlements", () => {
		const entitlement = buildMockEntitlement("pro", "https://app.test")

		expect(entitlement.tier).toBe("pro")
		expect(entitlement.capabilities.paperWriting).toBe(true)
		expect(entitlement.capabilities.dataStudio).toBe(false)
		expect(entitlement.upgradeUrl).toBe("https://app.test/billing")
	})

	it("builds checkout and portal URLs", () => {
		expect(buildMockCheckoutUrl("https://app.test", "plus")).toBe(
			"https://app.test/billing?tier=plus&source=extension-checkout",
		)
		expect(buildMockPortalUrl("https://app.test")).toBe("https://app.test/billing?source=extension-portal")
	})

	it("enables mock billing in development or when env var is true", () => {
		vi.stubEnv("NODE_ENV", "development")
		expect(isBillingMockEnabled()).toBe(true)

		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv("SCI_ROO_ENABLE_BILLING_MOCK", "true")
		expect(isBillingMockEnabled()).toBe(true)
	})
})
