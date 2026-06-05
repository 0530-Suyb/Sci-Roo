import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"

import type { AuthService } from "@roo-code/types"

import { CloudAPI } from "../CloudAPI.js"
import { AuthenticationError, CloudAPIError } from "../errors.js"

vi.mock("../config.js", () => ({
	getRooCodeApiUrl: () => "https://api.test.com",
}))

vi.mock("../utils.js", () => ({
	getUserAgent: () => "test-user-agent",
}))

describe("CloudAPI billing endpoints", () => {
	let mockAuthService: {
		getSessionToken: Mock<() => string | undefined>
	}
	let cloudAPI: CloudAPI

	beforeEach(() => {
		mockAuthService = {
			getSessionToken: vi.fn(),
		}
		cloudAPI = new CloudAPI(mockAuthService as unknown as AuthService)
		global.fetch = vi.fn()
	})

	it("fetches subscription entitlements", async () => {
		mockAuthService.getSessionToken.mockReturnValue("test-session-token")

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				tier: "pro",
				status: "active",
			}),
		})

		const entitlement = await cloudAPI.getSubscriptionEntitlement()

		expect(entitlement.tier).toBe("pro")
		expect(entitlement.capabilities.paperWriting).toBe(true)
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.test.com/api/extension/entitlements",
			expect.objectContaining({
				method: "GET",
			}),
		)
	})

	it("starts a subscription trial", async () => {
		mockAuthService.getSessionToken.mockReturnValue("test-session-token")

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				tier: "trial",
				status: "trialing",
				trialStartedAt: "2099-01-01T00:00:00.000Z",
				trialEndsAt: "2099-01-08T00:00:00.000Z",
			}),
		})

		const entitlement = await cloudAPI.startSubscriptionTrial()

		expect(entitlement.tier).toBe("trial")
		expect(entitlement.capabilities.dataStudio).toBe(true)
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.test.com/api/extension/trial/start",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({}),
			}),
		)
	})

	it("creates a checkout session", async () => {
		mockAuthService.getSessionToken.mockReturnValue("test-session-token")

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				url: "https://billing.test.com/checkout/pro",
			}),
		})

		const checkoutUrl = await cloudAPI.createCheckoutSession("pro")

		expect(checkoutUrl).toBe("https://billing.test.com/checkout/pro")
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.test.com/api/extension/billing/checkout-session",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ tier: "pro" }),
			}),
		)
	})

	it("fetches the billing portal URL", async () => {
		mockAuthService.getSessionToken.mockReturnValue("test-session-token")

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				url: "https://billing.test.com/portal",
			}),
		})

		const portalUrl = await cloudAPI.getBillingPortalUrl()

		expect(portalUrl).toBe("https://billing.test.com/portal")
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.test.com/api/extension/billing/portal-url",
			expect.objectContaining({
				method: "GET",
			}),
		)
	})

	it("requires authentication for billing endpoints", async () => {
		mockAuthService.getSessionToken.mockReturnValue(undefined)

		await expect(cloudAPI.getSubscriptionEntitlement()).rejects.toThrow(AuthenticationError)
		await expect(cloudAPI.startSubscriptionTrial()).rejects.toThrow(AuthenticationError)
		await expect(cloudAPI.createCheckoutSession("plus")).rejects.toThrow(AuthenticationError)
		await expect(cloudAPI.getBillingPortalUrl()).rejects.toThrow(AuthenticationError)
	})

	it("surfaces API errors from billing endpoints", async () => {
		mockAuthService.getSessionToken.mockReturnValue("test-session-token")

		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
			json: async () => ({ error: "Server error" }),
		})

		await expect(cloudAPI.getSubscriptionEntitlement()).rejects.toThrow(CloudAPIError)
	})
})
