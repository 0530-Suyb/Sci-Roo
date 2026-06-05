import { ArrowRight, Check, CircleHelp, Crown, FlaskConical, PenSquare, Search, Settings2 } from "lucide-react"

import {
	buildMockCheckoutUrl,
	buildMockEntitlement,
	buildMockPortalUrl,
	parseBillingMockTier,
} from "@/lib/billing/mock-billing"

type BillingPageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const planCards = [
	{
		tier: "plus",
		label: "Plus",
		price: "$12/mo",
		description: "Literature and reading workflows for day-to-day research scanning.",
		features: ["Research Pipeline", "Read Paper"],
		icon: Search,
		accent: "emerald",
	},
	{
		tier: "pro",
		label: "Pro",
		price: "$29/mo",
		description: "Adds manuscript drafting so the full paper loop lives in one workspace.",
		features: ["Everything in Plus", "Paper Writing"],
		icon: PenSquare,
		accent: "sky",
	},
	{
		tier: "max",
		label: "Max",
		price: "$79/mo",
		description: "Unlocks experiment execution surfaces for the full Sci-Roo workflow.",
		features: ["Everything in Pro", "Data Studio"],
		icon: FlaskConical,
		accent: "amber",
	},
] as const

const accentClasses = {
	emerald: "border-emerald-800/80 bg-emerald-950/30 text-emerald-100",
	sky: "border-sky-800/80 bg-sky-950/30 text-sky-100",
	amber: "border-amber-800/80 bg-amber-950/30 text-amber-100",
} as const

function firstParam(value: string | string[] | undefined): string | undefined {
	if (Array.isArray(value)) {
		return value[0]
	}
	return value
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
	const resolvedSearchParams = (await searchParams) ?? {}
	const requestedTier = parseBillingMockTier(firstParam(resolvedSearchParams.tier))
	const tier = requestedTier === "free" ? "plus" : requestedTier
	const source = firstParam(resolvedSearchParams.source) ?? "direct"
	const entitlement = buildMockEntitlement(tier, "https://mock.local")
	const entitlementFields = [
		["tier", entitlement.tier],
		["status", entitlement.status],
		["trialEndsAt", entitlement.trialEndsAt ?? "n/a"],
		["currentPeriodEndsAt", entitlement.currentPeriodEndsAt ?? "n/a"],
	]
	const capabilityRows = [
		{ label: "Research Pipeline", enabled: entitlement.capabilities.researchPipeline },
		{ label: "Read Paper", enabled: entitlement.capabilities.readPaper },
		{ label: "Paper Writing", enabled: entitlement.capabilities.paperWriting },
		{ label: "Data Studio", enabled: entitlement.capabilities.dataStudio },
	]
	const endpointUrls = [
		`/api/extension/entitlements?tier=${tier}`,
		"/api/extension/trial/start",
		"/api/extension/billing/checkout-session",
		"/api/extension/billing/portal-url",
	]

	return (
		<main className="min-h-screen bg-slate-950 text-slate-50">
			<section className="border-b border-slate-900 bg-slate-950">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl">
						<div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-300">
							<Crown className="h-3.5 w-3.5" />
							Sci-Roo Billing Mock
						</div>
						<h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
							Local checkout and entitlement flow for the extension.
						</h1>
						<p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
							Use this page to validate upgrade redirects, billing portal jumps, and tier-specific
							capability unlocks before the production billing backend is wired in.
						</p>
					</div>

					<div className="grid min-w-full gap-4 sm:grid-cols-2 lg:min-w-[360px] lg:max-w-md">
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
							<p className="text-sm text-slate-400">Requested Tier</p>
							<p className="mt-2 text-2xl font-semibold uppercase">{tier}</p>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
							<p className="text-sm text-slate-400">Source</p>
							<p className="mt-2 text-2xl font-semibold">{source}</p>
						</div>
					</div>
				</div>
			</section>

			<section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[1.3fr_0.9fr]">
				<div className="space-y-8">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">Plans</h2>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
							These are mock tiers for extension integration. The URLs below are the same shape that the
							extension uses when it opens checkout.
						</p>
						<div className="mt-6 grid gap-4 xl:grid-cols-3">
							{planCards.map((plan) => {
								const Icon = plan.icon
								const isSelected = plan.tier === tier

								return (
									<div
										key={plan.tier}
										className={`flex h-full flex-col justify-between rounded-lg border p-5 ${
											isSelected
												? accentClasses[plan.accent]
												: "border-slate-800 bg-slate-900 text-slate-100"
										}`}>
										<div>
											<div className="flex items-center justify-between gap-3">
												<div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-current/20 bg-black/10">
													<Icon className="h-5 w-5" />
												</div>
												{isSelected ? (
													<span className="rounded-full border border-current/25 px-2 py-1 text-xs font-medium uppercase tracking-[0.18em]">
														Current
													</span>
												) : null}
											</div>
											<h3 className="mt-5 text-xl font-semibold">{plan.label}</h3>
											<p className="mt-1 text-sm text-current/80">{plan.price}</p>
											<p className="mt-4 text-sm leading-6 text-current/80">{plan.description}</p>
											<ul className="mt-5 space-y-3 text-sm text-current/90">
												{plan.features.map((feature) => (
													<li key={feature} className="flex items-start gap-2">
														<Check className="mt-0.5 h-4 w-4 shrink-0" />
														<span>{feature}</span>
													</li>
												))}
											</ul>
										</div>

										<a
											href={buildMockCheckoutUrl("", plan.tier)}
											className="mt-6 inline-flex items-center justify-center gap-2 rounded-md border border-current/25 px-4 py-2 text-sm font-medium transition hover:bg-white/5">
											Open checkout
											<ArrowRight className="h-4 w-4" />
										</a>
									</div>
								)
							})}
						</div>
					</div>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
						<div className="flex items-center gap-3">
							<Settings2 className="h-5 w-5 text-slate-300" />
							<h2 className="text-xl font-semibold">Extension API quick links</h2>
						</div>
						<p className="mt-3 text-sm leading-6 text-slate-400">
							These are the endpoints the extension calls during entitlement refresh, trial activation,
							and billing actions.
						</p>
						<div className="mt-5 space-y-3">
							{endpointUrls.map((url) => (
								<a
									key={url}
									href={url}
									className="block overflow-x-auto rounded-md border border-slate-800 bg-slate-950 px-4 py-3 font-mono text-sm text-sky-300 hover:border-slate-700">
									{url}
								</a>
							))}
						</div>
					</div>
				</div>

				<div className="space-y-6">
					<div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
						<h2 className="text-xl font-semibold">Mock entitlement snapshot</h2>
						<div className="mt-5 space-y-3">
							{entitlementFields.map(([label, value]) => (
								<div
									key={label}
									className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
									<span className="text-sm text-slate-400">{label}</span>
									<span className="text-sm font-medium text-slate-100">{value}</span>
								</div>
							))}
						</div>

						<div className="mt-6 rounded-md border border-slate-800 bg-slate-950 p-4">
							<p className="text-sm font-medium text-slate-200">Capabilities</p>
							<ul className="mt-3 space-y-3">
								{capabilityRows.map((capability) => (
									<li
										key={capability.label}
										className="flex items-center justify-between gap-3 text-sm">
										<span className="text-slate-300">{capability.label}</span>
										<span
											className={`rounded-full px-2 py-1 text-xs font-medium uppercase tracking-[0.16em] ${
												capability.enabled
													? "bg-emerald-950 text-emerald-200"
													: "bg-slate-800 text-slate-300"
											}`}>
											{capability.enabled ? "Enabled" : "Locked"}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>

					<div className="rounded-lg border border-emerald-900/60 bg-emerald-950/40 p-6 text-sm leading-7 text-emerald-100">
						The extension-side premium gating, trial issuance, checkout redirect, and billing portal
						redirect can all point here during local development. Enable the mock API with{" "}
						<code>SCI_ROO_ENABLE_BILLING_MOCK=true</code> or force{" "}
						<code>SCI_ROO_BILLING_PROVIDER=mock</code>.
					</div>

					<div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
						<div className="flex items-center gap-3">
							<CircleHelp className="h-5 w-5 text-slate-300" />
							<h2 className="text-xl font-semibold">Quick actions</h2>
						</div>
						<div className="mt-5 grid gap-3 sm:grid-cols-2">
							<a
								href={buildMockPortalUrl("")}
								className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-800">
								Manage billing
							</a>
							<a
								href={`/billing?tier=trial&source=extension-trial`}
								className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-800">
								View trial state
							</a>
						</div>
					</div>
				</div>
			</section>
		</main>
	)
}
