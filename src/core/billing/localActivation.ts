import { createHash } from "node:crypto"

import { createSubscriptionEntitlement, type SubscriptionEntitlement, type SubscriptionTier } from "@roo-code/types"

export type ActivatedSubscriptionTier = Exclude<SubscriptionTier, "free" | "trial">

export type LocalActivationRecord = {
	tier: ActivatedSubscriptionTier
	keyHash: string
	keyMask: string
	activatedAt: string
	lastValidatedAt: string
}

export const LOCAL_ACTIVATION_CODE_WHITELIST = {
	plus: ["SCI-PLUS-DEMO-2026", "PLUS-DEMO-2026"],
	pro: ["SCI-PRO-DEMO-2026", "PRO-DEMO-2026"],
	max: ["SCI-MAX-DEMO-2026", "MAX-DEMO-2026"],
} as const

const activationTierOrder: Record<ActivatedSubscriptionTier, number> = {
	plus: 1,
	pro: 2,
	max: 3,
}

const activationCodePattern = /^(?:SCI-)?(PLUS|PRO|MAX)-[A-Z0-9]{4,}(?:-[A-Z0-9]{2,})*$/

export function normalizeActivationCode(value: string): string {
	return value.trim().toUpperCase().replace(/\s+/g, "")
}

export function getTierFromActivationCode(value: string): ActivatedSubscriptionTier | undefined {
	const normalized = normalizeActivationCode(value)
	const match = normalized.match(activationCodePattern)
	if (!match) {
		return undefined
	}

	switch (match[1]) {
		case "PLUS":
			return "plus"
		case "PRO":
			return "pro"
		case "MAX":
			return "max"
		default:
			return undefined
	}
}

export function isActivationCodeWhitelisted(value: string): boolean {
	const normalized = normalizeActivationCode(value)
	return Object.values(LOCAL_ACTIVATION_CODE_WHITELIST).some((codes) => codes.includes(normalized as never))
}

export function isActivationTierSufficient(
	activatedTier: ActivatedSubscriptionTier,
	requiredTier: SubscriptionTier | undefined,
): boolean {
	if (!requiredTier || requiredTier === "free" || requiredTier === "trial") {
		return true
	}

	return activationTierOrder[activatedTier] >= activationTierOrder[requiredTier]
}

export function createLocalActivationRecord(value: string, now = new Date()): LocalActivationRecord | undefined {
	const normalized = normalizeActivationCode(value)
	const tier = getTierFromActivationCode(normalized)
	if (!tier || !isActivationCodeWhitelisted(normalized)) {
		return undefined
	}

	return {
		tier,
		keyHash: createHash("sha256").update(normalized).digest("hex"),
		keyMask: maskActivationCode(normalized),
		activatedAt: now.toISOString(),
		lastValidatedAt: now.toISOString(),
	}
}

export function createEntitlementFromActivationRecord(record: LocalActivationRecord): SubscriptionEntitlement {
	return createSubscriptionEntitlement({
		tier: record.tier,
		status: "active",
		lastCheckedAt: record.lastValidatedAt,
	})
}

function maskActivationCode(value: string): string {
	if (value.length <= 8) {
		return value
	}

	return `${value.slice(0, 4)}...${value.slice(-4)}`
}
