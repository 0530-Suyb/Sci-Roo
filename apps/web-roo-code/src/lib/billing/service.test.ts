import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { BILLING_MOCK_ENV_VAR } from "./mock-billing"
import { REAL_BILLING_REQUIRE_AUTH_ENV_VAR } from "./real-billing"
import { BILLING_PROVIDER_ENV_VAR, createBillingRouteContext, resolveBillingService } from "./service"

describe("billing service resolution", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("creates a route context from the incoming request", () => {
		const context = createBillingRouteContext(
			new NextRequest("https://sci-roo.dev/api/extension/entitlements?tier=plus"),
		)

		expect(context.baseUrl).toBe("https://sci-roo.dev")
		expect(context.requestUrl.searchParams.get("tier")).toBe("plus")
	})

	it("uses the mock service in development mode", () => {
		vi.stubEnv("NODE_ENV", "development")

		const resolution = resolveBillingService()

		expect("service" in resolution && resolution.service.kind).toBe("mock")
	})

	it("uses the real service when explicitly selected", () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv(BILLING_PROVIDER_ENV_VAR, "real")
		vi.stubEnv(REAL_BILLING_REQUIRE_AUTH_ENV_VAR, "false")

		const resolution = resolveBillingService()

		expect("service" in resolution && resolution.service.kind).toBe("real")
	})

	it("uses the mock service when explicitly selected", () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv(BILLING_PROVIDER_ENV_VAR, "mock")

		const resolution = resolveBillingService()

		expect("service" in resolution && resolution.service.kind).toBe("mock")
	})

	it("falls back to unavailable when no provider is enabled", () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv(BILLING_MOCK_ENV_VAR, "false")

		const resolution = resolveBillingService()

		expect("service" in resolution).toBe(false)
		if ("service" in resolution) {
			return
		}

		expect(resolution.status).toBe(404)
		expect(resolution.error).toBe("Billing service unavailable")
	})
})
