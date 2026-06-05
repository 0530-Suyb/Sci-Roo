import {
	SUBSCRIPTION_CAPABILITIES_BY_TIER,
	createSubscriptionEntitlement,
	hasSubscriptionCapability,
	isSubscriptionTrialExpired,
	normalizeSubscriptionEntitlement,
} from "../billing.js"

describe("billing helpers", () => {
	it("maps plan tiers to the expected capabilities", () => {
		expect(SUBSCRIPTION_CAPABILITIES_BY_TIER.plus).toEqual({
			researchPipeline: true,
			readPaper: true,
			paperWriting: false,
			dataStudio: false,
		})
		expect(SUBSCRIPTION_CAPABILITIES_BY_TIER.pro.paperWriting).toBe(true)
		expect(SUBSCRIPTION_CAPABILITIES_BY_TIER.max.dataStudio).toBe(true)
	})

	it("fills default capabilities from tier during normalization", () => {
		const entitlement = normalizeSubscriptionEntitlement({
			tier: "pro",
			status: "active",
		})

		expect(entitlement.capabilities).toEqual({
			researchPipeline: true,
			readPaper: true,
			paperWriting: true,
			dataStudio: false,
		})
	})

	it("allows explicit capability overrides", () => {
		const entitlement = createSubscriptionEntitlement({
			tier: "plus",
			capabilities: {
				dataStudio: true,
			},
		})

		expect(entitlement.capabilities.dataStudio).toBe(true)
		expect(hasSubscriptionCapability(entitlement, "readPaper")).toBe(true)
	})

	it("detects expired trials using the provided clock", () => {
		const entitlement = createSubscriptionEntitlement({
			tier: "trial",
			trialEndsAt: "2026-01-10T00:00:00.000Z",
		})

		expect(isSubscriptionTrialExpired(entitlement, Date.parse("2026-01-09T23:59:59.000Z"))).toBe(false)
		expect(isSubscriptionTrialExpired(entitlement, Date.parse("2026-01-10T00:00:00.000Z"))).toBe(true)
	})
})
