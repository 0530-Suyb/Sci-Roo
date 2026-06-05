import { createSubscriptionEntitlement } from "@roo-code/types"

import { canAccessPremiumFeature, shouldAutoStartTrial, type PremiumFeatureRequirement } from "../subscription"

const plusRequirement: PremiumFeatureRequirement = {
	capability: "readPaper",
	minimumTier: "plus",
	featureLabel: "Read Paper",
}

describe("subscription gating helpers", () => {
	it("allows feature access during an active trial", () => {
		const entitlement = createSubscriptionEntitlement({
			tier: "trial",
			trialStartedAt: "2099-01-01T00:00:00.000Z",
			trialEndsAt: "2099-01-08T00:00:00.000Z",
		})

		expect(canAccessPremiumFeature(entitlement, plusRequirement)).toBe(true)
		expect(shouldAutoStartTrial(entitlement, plusRequirement)).toBe(false)
	})

	it("keeps free users eligible before the first trial starts", () => {
		const entitlement = createSubscriptionEntitlement({ tier: "free" })

		expect(canAccessPremiumFeature(entitlement, plusRequirement)).toBe(true)
		expect(shouldAutoStartTrial(entitlement, plusRequirement)).toBe(true)
	})

	it("blocks access when the plan lacks the required capability", () => {
		const entitlement = createSubscriptionEntitlement({ tier: "plus" })
		const proRequirement: PremiumFeatureRequirement = {
			capability: "paperWriting",
			minimumTier: "pro",
			featureLabel: "Paper Writing",
		}

		expect(canAccessPremiumFeature(entitlement, proRequirement)).toBe(false)
		expect(shouldAutoStartTrial(entitlement, proRequirement)).toBe(false)
	})

	it("blocks access after a trial expires", () => {
		const entitlement = createSubscriptionEntitlement({
			tier: "trial",
			trialStartedAt: "2026-01-01T00:00:00.000Z",
			trialEndsAt: "2020-01-08T00:00:00.000Z",
		})

		expect(canAccessPremiumFeature(entitlement, plusRequirement)).toBe(false)
	})
})
