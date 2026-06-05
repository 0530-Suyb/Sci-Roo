import { useId } from "react"
import { RefreshCw, Save } from "lucide-react"
import { RETRIEVAL_SOURCE_OPTIONS } from "@roo-code/types"

import { Button, Checkbox, Input, SearchableSelect, StandardTooltip } from "@/components/ui"
import type { Source, Strategy, WorkspaceFormState } from "./types"

type PlannerProfileOption = {
	value: string
	label: string
}

export type WorkspaceDefaultsPanelProps = {
	workspaceForm: WorkspaceFormState
	plannerProfileOptions: PlannerProfileOption[]
	onApplyWorkspaceProfileSelection: (profileId: string) => void
	onUpdateWorkspaceForm: <K extends keyof WorkspaceFormState>(key: K, value: WorkspaceFormState[K]) => void
	onToggleWorkspaceSource: (source: Source, checked: boolean) => void
	onSetWorkspaceStrategy: (strategy: Strategy) => void
	onSaveWorkspaceConfig: () => void
	onResetWorkspaceConfig: () => void
}

export function WorkspaceDefaultsPanel({
	workspaceForm,
	plannerProfileOptions,
	onApplyWorkspaceProfileSelection,
	onUpdateWorkspaceForm,
	onToggleWorkspaceSource,
	onSetWorkspaceStrategy,
	onSaveWorkspaceConfig,
	onResetWorkspaceConfig,
}: WorkspaceDefaultsPanelProps) {
	const formId = useId()
	const profileNameId = `${formId}-profile-name`
	const profileId = `${formId}-profile-id`
	const maxResultsId = `${formId}-max-results`
	const yearFromId = `${formId}-year-from`
	const yearToId = `${formId}-year-to`

	return (
		<section className="space-y-3">
			<div className="rounded-md border border-vscode-panel-border p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Workspace defaults</p>
						<h4 className="truncate text-sm font-semibold">Model, source and year defaults</h4>
						<p className="mt-1 text-xs text-muted-foreground">
							These values seed new retrieval sessions and draft runs.
						</p>
					</div>
					<div className="flex shrink-0 gap-2">
						<StandardTooltip content="Reset defaults">
							<Button
								variant="outline"
								size="icon"
								aria-label="Reset defaults"
								onClick={onResetWorkspaceConfig}>
								<RefreshCw className="h-4 w-4" aria-hidden="true" />
							</Button>
						</StandardTooltip>
						<StandardTooltip content="Save defaults">
							<Button
								variant="outline"
								size="icon"
								aria-label="Save defaults"
								onClick={onSaveWorkspaceConfig}>
								<Save className="h-4 w-4" aria-hidden="true" />
							</Button>
						</StandardTooltip>
					</div>
				</div>

				<div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="space-y-3">
						<div className="space-y-1">
							<div className="text-xs text-muted-foreground">Planner profile</div>
							<SearchableSelect
								value={workspaceForm.planner_profile_id}
								onValueChange={onApplyWorkspaceProfileSelection}
								options={plannerProfileOptions}
								placeholder="Select planner profile"
								searchPlaceholder="Search profiles"
								emptyMessage="No matching profile"
								className="w-full"
							/>
						</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<div className="space-y-1">
								<label htmlFor={profileNameId} className="text-xs font-medium text-muted-foreground">
									Profile name
								</label>
								<Input
									id={profileNameId}
									value={workspaceForm.planner_profile_name}
									onChange={(event) =>
										onUpdateWorkspaceForm("planner_profile_name", event.target.value)
									}
									placeholder="Profile name"
								/>
							</div>
							<div className="space-y-1">
								<label htmlFor={profileId} className="text-xs font-medium text-muted-foreground">
									Profile id
								</label>
								<Input
									id={profileId}
									value={workspaceForm.planner_profile_id}
									onChange={(event) =>
										onUpdateWorkspaceForm("planner_profile_id", event.target.value)
									}
									placeholder="Profile id"
								/>
							</div>
						</div>
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>Execution mode</span>
							<span className="rounded bg-vscode-badge-background px-2 py-1 text-vscode-badge-foreground">
								lightweight_job
							</span>
						</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<StandardTooltip content="Use only structured scholarly APIs and verified metadata">
								<Button
									variant={
										workspaceForm.default_retrieval_strategy === "scholarly_only"
											? "primary"
											: "outline"
									}
									size="sm"
									onClick={() => onSetWorkspaceStrategy("scholarly_only")}>
									Scholarly APIs
								</Button>
							</StandardTooltip>
							<StandardTooltip content="Request web discovery as a recall layer, then verify with scholarly metadata APIs">
								<Button
									variant={
										workspaceForm.default_retrieval_strategy === "scholarly_plus_web_discovery"
											? "primary"
											: "outline"
									}
									size="sm"
									onClick={() => onSetWorkspaceStrategy("scholarly_plus_web_discovery")}>
									APIs + discovery
								</Button>
							</StandardTooltip>
						</div>
					</div>

					<div className="space-y-3">
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
							<div className="space-y-1">
								<label htmlFor={maxResultsId} className="text-xs font-medium text-muted-foreground">
									Default max
								</label>
								<Input
									id={maxResultsId}
									type="number"
									min={1}
									max={200}
									value={workspaceForm.default_max_results}
									onChange={(event) =>
										onUpdateWorkspaceForm("default_max_results", event.target.value)
									}
									placeholder="Default max"
								/>
							</div>
							<div className="space-y-1">
								<label htmlFor={yearFromId} className="text-xs font-medium text-muted-foreground">
									Default from
								</label>
								<Input
									id={yearFromId}
									value={workspaceForm.default_year_from}
									onChange={(event) => onUpdateWorkspaceForm("default_year_from", event.target.value)}
									placeholder="Default from"
								/>
							</div>
							<div className="space-y-1">
								<label htmlFor={yearToId} className="text-xs font-medium text-muted-foreground">
									Default to
								</label>
								<Input
									id={yearToId}
									value={workspaceForm.default_year_to}
									onChange={(event) => onUpdateWorkspaceForm("default_year_to", event.target.value)}
									placeholder="Default to"
								/>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-4 text-sm">
							{RETRIEVAL_SOURCE_OPTIONS.map((sourceOption) => (
								<StandardTooltip key={sourceOption.value} content={sourceOption.description}>
									<label className="flex items-center gap-2">
										<Checkbox
											checked={workspaceForm.default_sources.includes(sourceOption.value)}
											onCheckedChange={(checked) =>
												onToggleWorkspaceSource(sourceOption.value, Boolean(checked))
											}
										/>
										<span>{sourceOption.label}</span>
									</label>
								</StandardTooltip>
							))}
						</div>
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
							<span>Default import target</span>
							<span className="rounded bg-vscode-badge-background px-2 py-1 text-vscode-badge-foreground">
								{workspaceForm.default_import_target}
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}
