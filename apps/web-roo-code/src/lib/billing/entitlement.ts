import type { BillingSubscriptionEntitlement, BillingSubscriptionTier } from "./types"

// This module belongs to the retained website-billing scaffold.
// The extension's current default premium flow is local trial + local activation code.
// Keep these helpers stable so we can later reconnect the extension to a real server-backed
// entitlement source without rebuilding the website billing layer from scratch.

export function parseBillingTier(value: string | null | undefined): BillingSubscriptionTier {
	switch (value) {
		case "trial":
		case "plus":
		case "pro":
		case "max":
			return value
		default:
			return "free"
	}
}

export function getBillingCapabilitiesForTier(
	tier: BillingSubscriptionTier,
): BillingSubscriptionEntitlement["capabilities"] {
	return {
		researchPipeline: tier === "trial" || tier === "plus" || tier === "pro" || tier === "max",
		readPaper: tier === "trial" || tier === "plus" || tier === "pro" || tier === "max",
		paperWriting: tier === "trial" || tier === "pro" || tier === "max",
		dataStudio: tier === "trial" || tier === "max",
	}
}

export function buildBillingEntitlement(
	tier: BillingSubscriptionTier,
	baseUrl: string,
	overrides: Partial<BillingSubscriptionEntitlement> = {},
): BillingSubscriptionEntitlement {
	const now = new Date()
	const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

	return {
		tier,
		status: tier === "trial" ? "trialing" : tier === "free" ? "free" : "active",
		trialStartedAt: overrides.trialStartedAt ?? (tier === "trial" ? now.toISOString() : undefined),
		trialEndsAt: overrides.trialEndsAt ?? (tier === "trial" ? trialEndsAt.toISOString() : undefined),
		currentPeriodEndsAt: overrides.currentPeriodEndsAt ?? (tier !== "free" ? trialEndsAt.toISOString() : undefined),
		capabilities: {
			...getBillingCapabilitiesForTier(tier),
			...(overrides.capabilities ?? {}),
		},
		upgradeUrl: overrides.upgradeUrl ?? `${baseUrl}/billing`,
		manageBillingUrl: overrides.manageBillingUrl ?? `${baseUrl}/billing`,
		lastCheckedAt: overrides.lastCheckedAt ?? now.toISOString(),
		...overrides,
	}
}

export function buildBillingCheckoutUrl(baseUrl: string, tier: BillingSubscriptionTier): string {
	return `${baseUrl}/billing?tier=${tier}&source=extension-checkout`
}

export function buildBillingPortalUrl(baseUrl: string): string {
	return `${baseUrl}/billing?source=extension-portal`
}
