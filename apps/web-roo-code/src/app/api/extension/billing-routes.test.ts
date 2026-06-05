import { afterEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import { GET as getEntitlements } from "./entitlements/route"
import { POST as startTrial } from "./trial/start/route"
import { POST as createCheckoutSession } from "./billing/checkout-session/route"
import { GET as getBillingPortal } from "./billing/portal-url/route"

describe("billing mock routes", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("returns a tier-aware entitlement payload when enabled", async () => {
		vi.stubEnv("SCI_ROO_ENABLE_BILLING_MOCK", "true")

		const response = await getEntitlements(
			new NextRequest("http://localhost:3000/api/extension/entitlements?tier=pro"),
		)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(response.headers.get("x-sci-roo-mock")).toBe("billing")
		expect(body.tier).toBe("pro")
		expect(body.capabilities.paperWriting).toBe(true)
		expect(body.capabilities.dataStudio).toBe(false)
	})

	it("starts a trial and returns trial capabilities when enabled", async () => {
		vi.stubEnv("SCI_ROO_ENABLE_BILLING_MOCK", "true")

		const response = await startTrial(
			new NextRequest("http://localhost:3000/api/extension/trial/start", { method: "POST" }),
		)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body.tier).toBe("trial")
		expect(body.status).toBe("trialing")
		expect(body.capabilities.dataStudio).toBe(true)
	})

	it("returns checkout and portal URLs when enabled", async () => {
		vi.stubEnv("SCI_ROO_ENABLE_BILLING_MOCK", "true")

		const checkoutResponse = await createCheckoutSession(
			new NextRequest("http://localhost:3000/api/extension/billing/checkout-session", {
				method: "POST",
				body: JSON.stringify({ tier: "max" }),
			}),
		)
		const checkoutBody = await checkoutResponse.json()

		const portalResponse = await getBillingPortal(
			new NextRequest("http://localhost:3000/api/extension/billing/portal-url"),
		)
		const portalBody = await portalResponse.json()

		expect(checkoutResponse.status).toBe(200)
		expect(checkoutBody.url).toBe("http://localhost:3000/billing?tier=max&source=extension-checkout")
		expect(portalResponse.status).toBe(200)
		expect(portalBody.url).toBe("http://localhost:3000/billing?source=extension-portal")
	})

	it("returns 404s when the mock is disabled", async () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv("SCI_ROO_ENABLE_BILLING_MOCK", "false")

		const entitlementsResponse = await getEntitlements(
			new NextRequest("http://localhost:3000/api/extension/entitlements"),
		)
		const trialResponse = await startTrial(
			new NextRequest("http://localhost:3000/api/extension/trial/start", { method: "POST" }),
		)
		const checkoutResponse = await createCheckoutSession(
			new NextRequest("http://localhost:3000/api/extension/billing/checkout-session", {
				method: "POST",
				body: JSON.stringify({ tier: "plus" }),
			}),
		)
		const portalResponse = await getBillingPortal(
			new NextRequest("http://localhost:3000/api/extension/billing/portal-url"),
		)

		expect(entitlementsResponse.status).toBe(404)
		expect(trialResponse.status).toBe(404)
		expect(checkoutResponse.status).toBe(404)
		expect(portalResponse.status).toBe(404)
	})

	it("returns 501s when the real billing provider is selected but not implemented", async () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv("SCI_ROO_BILLING_PROVIDER", "real")

		const entitlementsResponse = await getEntitlements(
			new NextRequest("http://localhost:3000/api/extension/entitlements"),
		)
		const entitlementsBody = await entitlementsResponse.json()
		const checkoutResponse = await createCheckoutSession(
			new NextRequest("http://localhost:3000/api/extension/billing/checkout-session", {
				method: "POST",
				body: JSON.stringify({ tier: "plus" }),
			}),
		)
		const checkoutBody = await checkoutResponse.json()

		expect(entitlementsResponse.status).toBe(401)
		expect(entitlementsBody.error).toContain("Missing bearer token")
		expect(checkoutResponse.status).toBe(401)
		expect(checkoutBody.error).toContain("Missing bearer token")
	})

	it("serves configured real-provider entitlements and billing URLs when authorized", async () => {
		vi.stubEnv("NODE_ENV", "production")
		vi.stubEnv("SCI_ROO_BILLING_PROVIDER", "real")
		vi.stubEnv(
			"SCI_ROO_BILLING_REAL_ENTITLEMENTS_JSON",
			JSON.stringify({
				"token:max-user-token": {
					tier: "max",
				},
			}),
		)
		vi.stubEnv("SCI_ROO_BILLING_REAL_CHECKOUT_BASE_URL", "https://billing.sci-roo.dev/checkout")
		vi.stubEnv("SCI_ROO_BILLING_REAL_PORTAL_BASE_URL", "https://billing.sci-roo.dev/portal")

		const headers = new Headers({
			authorization: "Bearer max-user-token",
		})
		const entitlementsResponse = await getEntitlements(
			new NextRequest("http://localhost:3000/api/extension/entitlements", { headers }),
		)
		const entitlementsBody = await entitlementsResponse.json()
		const checkoutResponse = await createCheckoutSession(
			new NextRequest("http://localhost:3000/api/extension/billing/checkout-session", {
				method: "POST",
				body: JSON.stringify({ tier: "max" }),
				headers,
			}),
		)
		const checkoutBody = await checkoutResponse.json()
		const portalResponse = await getBillingPortal(
			new NextRequest("http://localhost:3000/api/extension/billing/portal-url", { headers }),
		)
		const portalBody = await portalResponse.json()

		expect(entitlementsResponse.status).toBe(200)
		expect(entitlementsResponse.headers.get("x-sci-roo-mock")).toBeNull()
		expect(entitlementsBody.tier).toBe("max")
		expect(entitlementsBody.capabilities.dataStudio).toBe(true)
		expect(checkoutResponse.status).toBe(200)
		expect(checkoutBody.url).toBe("https://billing.sci-roo.dev/checkout?tier=max")
		expect(portalResponse.status).toBe(200)
		expect(portalBody.url).toBe("https://billing.sci-roo.dev/portal")
	})
})
