export type BillingSubscriptionTier = "free" | "trial" | "plus" | "pro" | "max"

export type BillingSubscriptionStatus = "free" | "active" | "trialing" | "expired" | "canceled" | "past_due"

export type BillingSubscriptionEntitlement = {
	tier: BillingSubscriptionTier
	status: BillingSubscriptionStatus
	trialStartedAt?: string
	trialEndsAt?: string
	currentPeriodEndsAt?: string
	capabilities: {
		researchPipeline: boolean
		readPaper: boolean
		paperWriting: boolean
		dataStudio: boolean
	}
	upgradeUrl?: string
	manageBillingUrl?: string
	lastCheckedAt?: string
}

export type BillingRouteContext = {
	baseUrl: string
	requestUrl: URL
	requestHeaders: Headers
}

export interface BillingService {
	readonly kind: "mock" | "real"
	getEntitlement(
		input: { tier?: string | null | undefined } & BillingRouteContext,
	): Promise<BillingSubscriptionEntitlement>
	startTrial(input: BillingRouteContext): Promise<BillingSubscriptionEntitlement>
	createCheckoutSession(input: { tier?: string | null | undefined } & BillingRouteContext): Promise<{ url: string }>
	getBillingPortalUrl(input: BillingRouteContext): Promise<{ url: string }>
}
