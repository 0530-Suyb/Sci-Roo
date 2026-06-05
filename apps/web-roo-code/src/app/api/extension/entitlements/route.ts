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
		const entitlement = await resolution.service.getEntitlement({
			tier: routeContext.requestUrl.searchParams.get("tier"),
			...routeContext,
		})

		return NextResponse.json(entitlement, {
			headers: createBillingRouteHeaders(resolution.service),
		})
	} catch (error) {
		return createBillingServiceErrorResponse(error)
	}
}
