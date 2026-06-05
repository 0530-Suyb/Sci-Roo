import {
	type SubscriptionCapabilityKey,
	type SubscriptionEntitlement,
	type SubscriptionTier,
	hasSubscriptionCapability,
	isSubscriptionTrialExpired,
} from "@roo-code/types"

export type PremiumFeatureRequirement = {
	capability: SubscriptionCapabilityKey
	minimumTier: SubscriptionTier
	featureLabel: string
}

export function canAccessPremiumFeature(
	entitlement: SubscriptionEntitlement | null | undefined,
	requirement: PremiumFeatureRequirement | undefined,
): boolean {
	if (!requirement) {
		return true
	}

	if (hasSubscriptionCapability(entitlement, requirement.capability)) {
		return !isSubscriptionTrialExpired(entitlement)
	}

	return entitlement?.tier === "free" && !entitlement?.trialStartedAt
}

export function shouldAutoStartTrial(
	entitlement: SubscriptionEntitlement | null | undefined,
	requirement: PremiumFeatureRequirement | undefined,
): boolean {
	if (!requirement || !entitlement) {
		return false
	}

	return (
		entitlement.tier === "free" &&
		!entitlement.trialStartedAt &&
		!hasSubscriptionCapability(entitlement, requirement.capability)
	)
}
