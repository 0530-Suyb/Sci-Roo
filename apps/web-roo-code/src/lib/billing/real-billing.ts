import {
	buildBillingCheckoutUrl,
	buildBillingEntitlement,
	buildBillingPortalUrl,
	parseBillingTier,
} from "./entitlement"
import type {
	BillingRouteContext,
	BillingService,
	BillingSubscriptionEntitlement,
	BillingSubscriptionTier,
} from "./types"

export const REAL_BILLING_REQUIRE_AUTH_ENV_VAR = "SCI_ROO_BILLING_REAL_REQUIRE_AUTH"
export const REAL_BILLING_DEFAULT_TIER_ENV_VAR = "SCI_ROO_BILLING_REAL_DEFAULT_TIER"
export const REAL_BILLING_ENTITLEMENTS_ENV_VAR = "SCI_ROO_BILLING_REAL_ENTITLEMENTS_JSON"
export const REAL_BILLING_CHECKOUT_BASE_URL_ENV_VAR = "SCI_ROO_BILLING_REAL_CHECKOUT_BASE_URL"
export const REAL_BILLING_PORTAL_BASE_URL_ENV_VAR = "SCI_ROO_BILLING_REAL_PORTAL_BASE_URL"

type RealBillingRecord = Partial<BillingSubscriptionEntitlement> & {
	tier?: BillingSubscriptionTier
	trialEligible?: boolean
}

export class BillingServiceHttpError extends Error {
	readonly status: number

	constructor(status: number, message: string) {
		super(message)
		this.name = "BillingServiceHttpError"
		this.status = status
	}
}

type RealBillingIdentity = {
	lookupKey: string
	subject: string
}

function isRealBillingAuthRequired(): boolean {
	return process.env[REAL_BILLING_REQUIRE_AUTH_ENV_VAR] !== "false"
}

function getConfiguredDefaultTier(): BillingSubscriptionTier {
	return parseBillingTier(process.env[REAL_BILLING_DEFAULT_TIER_ENV_VAR])
}

function parseEntitlementOverrides(): Record<string, RealBillingRecord> {
	const raw = process.env[REAL_BILLING_ENTITLEMENTS_ENV_VAR]
	if (!raw) {
		return {}
	}

	try {
		const parsed = JSON.parse(raw)
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {}
		}

		return parsed as Record<string, RealBillingRecord>
	} catch (_error) {
		throw new BillingServiceHttpError(500, `Invalid ${REAL_BILLING_ENTITLEMENTS_ENV_VAR} JSON`)
	}
}

function getBearerToken(headers: Headers): string | undefined {
	const authHeader = headers.get("authorization")
	if (!authHeader) {
		return undefined
	}

	const [scheme, token] = authHeader.split(" ")
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return undefined
	}

	return token
}

function getBillingIdentity({ requestHeaders }: BillingRouteContext): RealBillingIdentity {
	const token = getBearerToken(requestHeaders)
	const explicitUserId = requestHeaders.get("x-sci-roo-user-id")
	const subject = explicitUserId ?? token

	if (!subject) {
		if (isRealBillingAuthRequired()) {
			throw new BillingServiceHttpError(401, "Missing bearer token for billing request")
		}

		return {
			lookupKey: "anonymous",
			subject: "anonymous",
		}
	}

	if (explicitUserId) {
		return {
			lookupKey: `user:${explicitUserId}`,
			subject: explicitUserId,
		}
	}

	return {
		lookupKey: `token:${token}`,
		subject,
	}
}

function resolveBillingRecord(identity: RealBillingIdentity): RealBillingRecord {
	const configured = parseEntitlementOverrides()

	return configured[identity.lookupKey] ?? configured[identity.subject] ?? {}
}

function buildRealBillingCheckoutUrl(baseUrl: string, tier: BillingSubscriptionTier): string {
	const configuredBase = process.env[REAL_BILLING_CHECKOUT_BASE_URL_ENV_VAR]
	if (configuredBase) {
		return `${configuredBase}?tier=${tier}`
	}

	return buildBillingCheckoutUrl(baseUrl, tier)
}

function buildRealBillingPortalUrl(baseUrl: string): string {
	const configuredBase = process.env[REAL_BILLING_PORTAL_BASE_URL_ENV_VAR]
	if (configuredBase) {
		return configuredBase
	}

	return buildBillingPortalUrl(baseUrl)
}

function buildResolvedEntitlement(
	baseUrl: string,
	record: RealBillingRecord,
	fallbackTier = getConfiguredDefaultTier(),
): BillingSubscriptionEntitlement {
	const tier = record.tier ?? fallbackTier

	return buildBillingEntitlement(tier, baseUrl, {
		...record,
		upgradeUrl: record.upgradeUrl ?? buildRealBillingCheckoutUrl(baseUrl, tier === "free" ? "plus" : tier),
		manageBillingUrl: record.manageBillingUrl ?? buildRealBillingPortalUrl(baseUrl),
	})
}

export const realBillingService: BillingService = {
	kind: "real",
	async getEntitlement(routeContext) {
		const identity = getBillingIdentity(routeContext)
		const record = resolveBillingRecord(identity)

		return buildResolvedEntitlement(routeContext.baseUrl, record)
	},
	async startTrial(routeContext) {
		const identity = getBillingIdentity(routeContext)
		const record = resolveBillingRecord(identity)
		const currentEntitlement = buildResolvedEntitlement(routeContext.baseUrl, record)

		if (currentEntitlement.tier !== "free" || record.trialEligible === false) {
			return currentEntitlement
		}

		return buildResolvedEntitlement(routeContext.baseUrl, {
			...record,
			tier: "trial",
			status: "trialing",
		})
	},
	async createCheckoutSession({ tier, ...routeContext }) {
		getBillingIdentity(routeContext)
		const parsedTier = parseBillingTier(tier)

		return {
			url: buildRealBillingCheckoutUrl(routeContext.baseUrl, parsedTier === "free" ? "plus" : parsedTier),
		}
	},
	async getBillingPortalUrl(routeContext) {
		getBillingIdentity(routeContext)

		return {
			url: buildRealBillingPortalUrl(routeContext.baseUrl),
		}
	},
}
