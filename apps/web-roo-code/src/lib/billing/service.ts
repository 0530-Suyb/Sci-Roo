import { NextRequest, NextResponse } from "next/server"

import { isBillingMockEnabled, mockBillingService } from "./mock-billing"
import { BillingServiceHttpError, realBillingService } from "./real-billing"
import type { BillingRouteContext, BillingService } from "./types"

// This resolver is intentionally retained even though the extension currently unlocks
// premium features through the local activation-code flow. It defines the future
// website-backed billing switch we can reconnect later.

export const BILLING_PROVIDER_ENV_VAR = "SCI_ROO_BILLING_PROVIDER"

export type BillingProvider = "mock" | "real"

type BillingServiceResolution =
	| {
			service: BillingService
	  }
	| {
			error: string
			status: number
	  }

function parseBillingProvider(value: string | null | undefined): BillingProvider | undefined {
	switch (value) {
		case "mock":
		case "real":
			return value
		default:
			return undefined
	}
}

export function createBillingRouteContext(request: NextRequest): BillingRouteContext {
	const requestUrl = new URL(request.url)

	return {
		baseUrl: `${requestUrl.protocol}//${requestUrl.host}`,
		requestUrl,
		requestHeaders: request.headers,
	}
}

export function resolveBillingService(): BillingServiceResolution {
	const configuredProvider = parseBillingProvider(process.env[BILLING_PROVIDER_ENV_VAR])

	if (configuredProvider === "real") {
		return { service: realBillingService }
	}

	if (configuredProvider === "mock" || isBillingMockEnabled()) {
		return { service: mockBillingService }
	}

	return {
		error: "Billing service unavailable",
		status: 404,
	}
}

export function createBillingUnavailableResponse(resolution: Extract<BillingServiceResolution, { error: string }>) {
	return NextResponse.json({ error: resolution.error }, { status: resolution.status })
}

export function createBillingRouteHeaders(service: BillingService): HeadersInit | undefined {
	if (service.kind === "mock") {
		return {
			"x-sci-roo-mock": "billing",
		}
	}

	return undefined
}

export function createBillingServiceErrorResponse(error: unknown) {
	if (error instanceof BillingServiceHttpError) {
		return NextResponse.json({ error: error.message }, { status: error.status })
	}

	console.error("Billing route failed", error)
	return NextResponse.json({ error: "Billing route failed" }, { status: 500 })
}
