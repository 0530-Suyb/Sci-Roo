import { NextRequest, NextResponse } from "next/server"

import {
	createBillingRouteContext,
	createBillingRouteHeaders,
	createBillingServiceErrorResponse,
	createBillingUnavailableResponse,
	resolveBillingService,
} from "@/lib/billing/service"

export async function POST(request: NextRequest) {
	const resolution = resolveBillingService()
	if (!("service" in resolution)) {
		return createBillingUnavailableResponse(resolution)
	}

	const routeContext = createBillingRouteContext(request)
	const body = await request.json().catch(() => ({}))

	try {
		const checkoutSession = await resolution.service.createCheckoutSession({
			tier: typeof body?.tier === "string" ? body.tier : undefined,
			...routeContext,
		})

		return NextResponse.json(checkoutSession, {
			headers: createBillingRouteHeaders(resolution.service),
		})
	} catch (error) {
		return createBillingServiceErrorResponse(error)
	}
}
