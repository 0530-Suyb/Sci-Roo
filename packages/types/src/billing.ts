import { z } from "zod"

export const subscriptionTierSchema = z.enum(["free", "trial", "plus", "pro", "max"])
export type SubscriptionTier = z.infer<typeof subscriptionTierSchema>

export const subscriptionStatusSchema = z.enum(["free", "active", "trialing", "expired", "canceled", "past_due"])
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>

export const subscriptionCapabilitiesSchema = z.object({
	researchPipeline: z.boolean(),
	readPaper: z.boolean(),
	paperWriting: z.boolean(),
	dataStudio: z.boolean(),
})

export type SubscriptionCapabilities = z.infer<typeof subscriptionCapabilitiesSchema>
export type SubscriptionCapabilityKey = keyof SubscriptionCapabilities

export const SUBSCRIPTION_CAPABILITIES_BY_TIER: Record<SubscriptionTier, SubscriptionCapabilities> = {
	free: {
		researchPipeline: false,
		readPaper: false,
		paperWriting: false,
		dataStudio: false,
	},
	trial: {
		researchPipeline: true,
		readPaper: true,
		paperWriting: true,
		dataStudio: true,
	},
	plus: {
		researchPipeline: true,
		readPaper: true,
		paperWriting: false,
		dataStudio: false,
	},
	pro: {
		researchPipeline: true,
		readPaper: true,
		paperWriting: true,
		dataStudio: false,
	},
	max: {
		researchPipeline: true,
		readPaper: true,
		paperWriting: true,
		dataStudio: true,
	},
}

export const subscriptionEntitlementSchema = z.object({
	tier: subscriptionTierSchema.default("free"),
	status: subscriptionStatusSchema.default("free"),
	trialStartedAt: z.string().datetime().optional(),
	trialEndsAt: z.string().datetime().optional(),
	currentPeriodEndsAt: z.string().datetime().optional(),
	capabilities: subscriptionCapabilitiesSchema.optional(),
	upgradeUrl: z.string().url().optional(),
	manageBillingUrl: z.string().url().optional(),
	lastCheckedAt: z.string().datetime().optional(),
})

export type SubscriptionEntitlement = z.infer<typeof subscriptionEntitlementSchema> & {
	capabilities: SubscriptionCapabilities
}

export function getSubscriptionCapabilitiesForTier(tier: SubscriptionTier): SubscriptionCapabilities {
	return SUBSCRIPTION_CAPABILITIES_BY_TIER[tier]
}

export function createSubscriptionEntitlement(
	overrides: Partial<Omit<SubscriptionEntitlement, "capabilities">> & {
		capabilities?: Partial<SubscriptionCapabilities>
	} = {},
): SubscriptionEntitlement {
	const tier = overrides.tier ?? "free"
	return {
		tier,
		status: overrides.status ?? (tier === "trial" ? "trialing" : tier === "free" ? "free" : "active"),
		trialStartedAt: overrides.trialStartedAt,
		trialEndsAt: overrides.trialEndsAt,
		currentPeriodEndsAt: overrides.currentPeriodEndsAt,
		capabilities: {
			...getSubscriptionCapabilitiesForTier(tier),
			...(overrides.capabilities ?? {}),
		},
		upgradeUrl: overrides.upgradeUrl,
		manageBillingUrl: overrides.manageBillingUrl,
		lastCheckedAt: overrides.lastCheckedAt,
	}
}

export function normalizeSubscriptionEntitlement(input: unknown): SubscriptionEntitlement {
	const parsed = subscriptionEntitlementSchema.parse(input)
	return createSubscriptionEntitlement(parsed)
}

export function hasSubscriptionCapability(
	entitlement: SubscriptionEntitlement | null | undefined,
	capability: SubscriptionCapabilityKey,
): boolean {
	return entitlement?.capabilities?.[capability] === true
}

export function isSubscriptionTrialExpired(entitlement: SubscriptionEntitlement | null | undefined, now = Date.now()) {
	if (!entitlement?.trialEndsAt) {
		return false
	}

	const expiresAt = Date.parse(entitlement.trialEndsAt)
	if (Number.isNaN(expiresAt)) {
		return false
	}

	return expiresAt <= now
}
