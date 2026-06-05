import type {
	BillingRouteContext,
	BillingService,
	BillingSubscriptionEntitlement,
	BillingSubscriptionTier,
} from "./types"
import {
	buildBillingCheckoutUrl,
	buildBillingEntitlement,
	buildBillingPortalUrl,
	parseBillingTier,
} from "./entitlement"

export const BILLING_MOCK_ENV_VAR = "SCI_ROO_ENABLE_BILLING_MOCK"

export function isBillingMockEnabled(): boolean {
	return process.env.NODE_ENV === "development" || process.env[BILLING_MOCK_ENV_VAR] === "true"
}

export function parseBillingMockTier(value: string | null | undefined): BillingSubscriptionTier {
	return parseBillingTier(value)
}

export function buildMockEntitlement(
	tier: BillingSubscriptionTier,
	baseUrl: string,
	overrides: Partial<BillingSubscriptionEntitlement> = {},
): BillingSubscriptionEntitlement {
	return buildBillingEntitlement(tier, baseUrl, overrides)
}

export function buildMockCheckoutUrl(baseUrl: string, tier: BillingSubscriptionTier): string {
	return buildBillingCheckoutUrl(baseUrl, tier)
}

export function buildMockPortalUrl(baseUrl: string): string {
	return buildBillingPortalUrl(baseUrl)
}

export const mockBillingService: BillingService = {
	kind: "mock",
	async getEntitlement({ tier, baseUrl }: { tier?: string | null | undefined } & BillingRouteContext) {
		return buildMockEntitlement(parseBillingMockTier(tier), baseUrl)
	},
	async startTrial({ baseUrl }: BillingRouteContext) {
		return buildMockEntitlement("trial", baseUrl)
	},
	async createCheckoutSession({ tier, baseUrl }: { tier?: string | null | undefined } & BillingRouteContext) {
		const parsedTier = parseBillingMockTier(tier)
		return {
			url: buildMockCheckoutUrl(baseUrl, parsedTier === "free" ? "plus" : parsedTier),
		}
	},
	async getBillingPortalUrl({ baseUrl }: BillingRouteContext) {
		return {
			url: buildMockPortalUrl(baseUrl),
		}
	},
}
