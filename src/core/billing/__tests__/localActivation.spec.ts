import { describe, expect, it } from "vitest"

import {
	LOCAL_ACTIVATION_CODE_WHITELIST,
	createEntitlementFromActivationRecord,
	createLocalActivationRecord,
	getTierFromActivationCode,
	isActivationCodeWhitelisted,
	isActivationTierSufficient,
	normalizeActivationCode,
} from "../localActivation"

describe("localActivation", () => {
	it("normalizes activation codes before parsing", () => {
		expect(normalizeActivationCode(" sci-pro-abcd-1234 ")).toBe("SCI-PRO-ABCD-1234")
	})

	it("extracts the subscription tier from supported activation code prefixes", () => {
		expect(getTierFromActivationCode("PLUS-ABCD-1234")).toBe("plus")
		expect(getTierFromActivationCode("SCI-PRO-ABCD-1234")).toBe("pro")
		expect(getTierFromActivationCode("MAX-ABCD-1234")).toBe("max")
		expect(getTierFromActivationCode("BASIC-ABCD-1234")).toBeUndefined()
	})

	it("creates a stable local activation record with a masked key and hash", () => {
		const record = createLocalActivationRecord("SCI-MAX-DEMO-2026", new Date("2099-01-01T00:00:00.000Z"))

		expect(record).toEqual({
			tier: "max",
			keyHash: expect.any(String),
			keyMask: "SCI-...2026",
			activatedAt: "2099-01-01T00:00:00.000Z",
			lastValidatedAt: "2099-01-01T00:00:00.000Z",
		})
	})

	it("only accepts activation codes that are in the local whitelist", () => {
		expect(isActivationCodeWhitelisted("SCI-PLUS-DEMO-2026")).toBe(true)
		expect(isActivationCodeWhitelisted("PRO-DEMO-2026")).toBe(true)
		expect(isActivationCodeWhitelisted("MAX-TEST-1234")).toBe(false)
		expect(createLocalActivationRecord("MAX-TEST-1234")).toBeUndefined()
	})

	it("checks whether an activated tier satisfies the required tier", () => {
		expect(isActivationTierSufficient("pro", "plus")).toBe(true)
		expect(isActivationTierSufficient("pro", "max")).toBe(false)
		expect(isActivationTierSufficient("max", "pro")).toBe(true)
	})

	it("maps an activation record into an active entitlement", () => {
		const record = createLocalActivationRecord(
			LOCAL_ACTIVATION_CODE_WHITELIST.plus[0],
			new Date("2099-01-01T00:00:00.000Z"),
		)
		expect(record).toBeDefined()

		const entitlement = createEntitlementFromActivationRecord(record!)
		expect(entitlement.tier).toBe("plus")
		expect(entitlement.status).toBe("active")
		expect(entitlement.capabilities.readPaper).toBe(true)
		expect(entitlement.capabilities.paperWriting).toBe(false)
	})
})
