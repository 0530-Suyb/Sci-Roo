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

	try {
		const entitlement = await resolution.service.startTrial(routeContext)

		return NextResponse.json(entitlement, {
			headers: createBillingRouteHeaders(resolution.service),
		})
	} catch (error) {
		return createBillingServiceErrorResponse(error)
	}
}
