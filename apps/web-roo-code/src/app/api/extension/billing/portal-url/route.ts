import { NextRequest, NextResponse } from "next/server"

import {
	createBillingRouteContext,
	createBillingRouteHeaders,
	createBillingServiceErrorResponse,
	createBillingUnavailableResponse,
	resolveBillingService,
} from "@/lib/billing/service"

export async function GET(request: NextRequest) {
	const resolution = resolveBillingService()
	if (!("service" in resolution)) {
		return createBillingUnavailableResponse(resolution)
	}

	const routeContext = createBillingRouteContext(request)

	try {
		const portalUrl = await resolution.service.getBillingPortalUrl(routeContext)

		return NextResponse.json(portalUrl, {
			headers: createBillingRouteHeaders(resolution.service),
		})
	} catch (error) {
		return createBillingServiceErrorResponse(error)
	}
}
