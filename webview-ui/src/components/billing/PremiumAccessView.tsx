import * as React from "react"
import { ArrowLeft, KeyRound, Lock, RefreshCw, Trash2 } from "lucide-react"

import { type SubscriptionEntitlement, type SubscriptionTier } from "@roo-code/types"

import { Button } from "@/components/ui/button"
import { vscode } from "@/utils/vscode"

type PremiumAccessViewProps = {
	entitlement?: SubscriptionEntitlement
	featureLabel: string
	minimumTier: SubscriptionTier
	onBack: () => void
}

const tierDisplayNames: Record<SubscriptionTier, string> = {
	free: "Free",
	trial: "Trial",
	plus: "Plus",
	pro: "Pro",
	max: "Max",
}

const formatExpiry = (value?: string) => {
	if (!value) {
		return null
	}

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) {
		return null
	}

	return new Intl.DateTimeFormat(undefined, {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).format(date)
}

const PremiumAccessView: React.FC<PremiumAccessViewProps> = ({ entitlement, featureLabel, minimumTier, onBack }) => {
	const currentTier = entitlement?.tier ?? "free"
	const expiresAt = entitlement?.trialEndsAt ?? entitlement?.currentPeriodEndsAt
	const formattedExpiry = formatExpiry(expiresAt)

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6">
			<div className="w-full max-w-2xl rounded-2xl border border-vscode-panel-border bg-card p-8 shadow-sm">
				<div className="flex items-start justify-between gap-4">
					<div>
						<div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary">
							<Lock className="h-5 w-5" />
						</div>
						<h1 className="mt-4 text-2xl font-semibold">{featureLabel} is locked</h1>
						<p className="mt-2 text-sm text-muted-foreground">
							This workspace feature requires the {tierDisplayNames[minimumTier]} tier. Your current
							access level is {tierDisplayNames[currentTier]}. Enter an activation code to unlock more
							features on this device.
						</p>
						{formattedExpiry ? (
							<p className="mt-3 text-xs text-muted-foreground">
								Current access expires at{" "}
								<span className="font-medium text-foreground">{formattedExpiry}</span>
							</p>
						) : null}
					</div>
					<Button variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
						<ArrowLeft />
					</Button>
				</div>

				<div className="mt-6 grid gap-3 rounded-xl border border-vscode-panel-border/70 bg-background p-4 text-sm">
					<div className="flex items-center justify-between gap-4">
						<span>Plus</span>
						<span className="text-muted-foreground">Research Pipeline, Read Paper</span>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span>Pro</span>
						<span className="text-muted-foreground">Everything in Plus, plus Paper Writing</span>
					</div>
					<div className="flex items-center justify-between gap-4">
						<span>Max</span>
						<span className="text-muted-foreground">Everything in Pro, plus Data Studio experiments</span>
					</div>
				</div>

				<div className="mt-6 flex flex-wrap gap-3">
					<Button
						variant="primary"
						onClick={() => vscode.postMessage({ type: "enterActivationCode", tier: minimumTier })}>
						<KeyRound />
						Enter Activation Code
					</Button>
					<Button
						variant="outline"
						onClick={() => vscode.postMessage({ type: "refreshSubscriptionEntitlement" })}>
						<RefreshCw />
						Refresh Access
					</Button>
					<Button variant="ghost" onClick={() => vscode.postMessage({ type: "clearActivationCode" })}>
						<Trash2 />
						Clear Activation
					</Button>
				</div>
			</div>
		</div>
	)
}

export default React.memo(PremiumAccessView)
