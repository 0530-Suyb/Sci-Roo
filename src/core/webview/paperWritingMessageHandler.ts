import type { ClineProvider } from "./ClineProvider"
import type { WebviewMessage } from "@roo-code/types"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import type { SectionType } from "@roo-code/types"
import { runPaperWorkspaceCommand } from "../../services/paper/paperWorkspaceActions"
import { buildPaperWorkspaceState } from "../../services/paper/paperWorkspaceState"

// ─── Legacy handlers (kept for backward compat during transition) ────

export async function handlePaperWritingAction(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const action = message.action as string | undefined
		const text = message.text as string | undefined
		const paperProject = provider.getPaperProjectManager()
		const referenceMgr = provider.getReferenceManager()
		const sectionMgr = provider.getPaperSectionManager()

		if (!paperProject || !referenceMgr || !sectionMgr) {
			await provider.postMessageToWebview({
				type: "paperWritingState",
				paperWritingState: { error: "Paper Writing v2 services not initialized" },
			})
			return
		}

		const currentProject = paperProject.getCurrentProject()
		const buildWritingPayload = async (templateId: string, missingCitationKeys: string[] = []) => {
			const writingState = await sectionMgr.getWritingState(templateId)
			const wordStatus = await sectionMgr.getSectionWordStatus(templateId)
			const sectionInsights = await sectionMgr.getSectionInsights(templateId, missingCitationKeys)
			return { writingState, wordStatus, sectionInsights }
		}
		switch (action) {
			// ── Project Management ──
			case "projectCreate": {
				const name = (message.text as string) || "Research Project"
				const description = ((message as any).description as string) || ""
				const directoryTemplate = ((message as any).directoryTemplate as string) || "ml-paper"
				const venueTemplateId = ((message as any).venueTemplateId as string) || "generic"
				const customStructure = (message as any).customStructure
				const project = await paperProject.createProject({
					name,
					description,
					directoryTemplate,
					venueTemplateId,
					customStructure,
				})
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project },
				})
				const entries = await referenceMgr.listEntries()
				const uncatalogued = await referenceMgr.scanUncataloguedPdfs()
				const { cited, missing } = await referenceMgr.scanTexCitations()
				const workspaceState = await buildPaperWorkspaceState(provider, project, {
					missingCitationKeys: missing,
					citedKeys: cited,
				})
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project, workspaceState },
				})
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { entries, uncatalogued, cited, missing },
				})
				return
			}
			case "projectList": {
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project: currentProject, message: "list not yet implemented" },
				})
				return
			}
			case "projectRefresh": {
				if (!currentProject) return
				const entries = await referenceMgr.listEntries()
				const uncatalogued = await referenceMgr.scanUncataloguedPdfs()
				const { cited, missing } = await referenceMgr.scanTexCitations()
				const snapshots = await sectionMgr.listSnapshots()
				const workspaceState = await buildPaperWorkspaceState(provider, currentProject, {
					missingCitationKeys: missing,
					citedKeys: cited,
				})
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: {
						project: currentProject,
						referenceEntries: entries,
						uncatalogued,
						workspaceState,
					},
				})
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { entries, uncatalogued, cited, missing },
				})
				await provider.postMessageToWebview({
					type: "paperSnapshotState",
					paperSnapshotState: { snapshots },
				})
				return
			}
			case "projectStageUpdate": {
				const stage = message.text as any
				if (!currentProject || !stage) return
				await paperProject.updateStage(stage)
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project: paperProject.getCurrentProject() },
				})
				return
			}
			case "workspaceCommand": {
				const command =
					(message.query as
						| "paperOpenManuscript"
						| "paperBuildManuscript"
						| "paperViewPdf"
						| "paperOpenSourceControl"
						| "paperRewriteSelection"
						| "paperRephraseSelection"
						| "paperMakeConciseSelection"
						| "paperMakeAcademicSelection"
						| "paperExpandAcademicParagraph"
						| "paperAddCitationPlaceholder"
						| "paperTranslateSelectionChinese"
						| "paperTranslateSelectionEnglish"
						| undefined) ?? undefined
				if (!command) {
					return
				}
				await runPaperWorkspaceCommand(provider, command)
				return
			}
			case "revisionLogSeed": {
				if (!currentProject) return
				const revisionLogPath = await paperProject.ensureRevisionLogTemplate()
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: {
						project: paperProject.getCurrentProject(),
						message: `Revision log template ready at ${revisionLogPath}`,
					},
				})
				return
			}

			// ── Section Management ──
			case "sectionLoad": {
				const sectionType = (message.query as SectionType) || ((message as any).sectionType as SectionType)
				if (!sectionType || !currentProject) return
				const { content, wordCount } = await sectionMgr.loadSection(sectionType)
				const configs = sectionMgr.getSectionConfig(currentProject.templateId, sectionType)
				const range = configs?.targetWordRange
				const sectionStatus = (await sectionMgr.getWritingState(currentProject.templateId)).sectionStatus[
					sectionType
				]
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: {
						sectionType,
						sectionContent: content,
						wordCount,
						sectionStatusValue: sectionStatus,
						targetWordRange: range,
						overLimit: range ? wordCount > range[1] : false,
					},
				})
				return
			}
			case "sectionAiWrite": {
				const sectionType = (message as any).sectionType as SectionType
				if (!sectionType || !currentProject) return
				const { prompt, sectionLabel } = await sectionMgr.buildAiWritePrompt(
					sectionType,
					currentProject.templateId,
				)
				const { apiConfiguration } = await provider.getState()
				const result = await singleCompletionHandler(apiConfiguration, prompt)
				if (result) {
					await sectionMgr.saveSection(sectionType, result)
					const wordCount = sectionMgr.countWords(result)
					const { missing } = await referenceMgr.scanTexCitations()
					const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
						currentProject.templateId,
						missing,
					)
					await provider.postMessageToWebview({
						type: "paperWritingState",
						paperWritingState: {
							sectionType,
							sectionContent: result,
							wordCount,
							writingState,
							wordStatus,
							sectionInsights,
							saved: true,
						},
					})
				}
				return
			}
			case "sectionSave": {
				const sectionType = (message as any).sectionType as SectionType
				const content = text || ""
				if (!sectionType || !currentProject) return
				await sectionMgr.saveSection(sectionType, content)
				const wordCount = sectionMgr.countWords(content)
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: {
						sectionType,
						sectionContent: content,
						wordCount,
						wordStatus,
						sectionStatusValue: writingState.sectionStatus[sectionType],
						sectionInsights,
						saved: true,
					},
				})
				return
			}
			case "sectionStatus": {
				if (!currentProject) return
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: { writingState, wordStatus, sectionInsights },
				})
				return
			}
			case "sectionAdd": {
				const sectionType = (message as any).sectionType as SectionType
				const sectionLabel = (message as any).sectionLabel as string
				if (!sectionType || !currentProject) return
				await sectionMgr.addSection(sectionType, sectionLabel)
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: { writingState, wordStatus, sectionInsights },
				})
				return
			}
			case "sectionDelete": {
				const sectionType = (message as any).sectionType as SectionType
				if (!sectionType || !currentProject) return
				await sectionMgr.deleteSection(sectionType)
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: { writingState, wordStatus, sectionInsights },
				})
				return
			}
			case "sectionRename": {
				const sectionType = (message as any).sectionType as SectionType
				const sectionLabel = (message as any).sectionLabel as string
				if (!sectionType || !sectionLabel || !currentProject) return
				await sectionMgr.renameSection(sectionType, sectionLabel)
				const updatedProject = await paperProject.updateSectionConfig(sectionType, { label: sectionLabel })
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: { writingState, wordStatus, sectionInsights },
				})
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project: updatedProject },
				})
				return
			}
			case "sectionConfigSave": {
				const sectionType = (message as any).sectionType as SectionType
				const targetWordRange = (message as any).targetWordRange as [number, number] | undefined
				const sectionStatusValue = (message as any).sectionStatusValue as
					| "outline"
					| "draft"
					| "revised"
					| "final"
					| undefined
				if (!sectionType || !currentProject || (!targetWordRange && !sectionStatusValue)) return
				const updatedProject = await paperProject.updateSectionConfig(sectionType, {
					...(targetWordRange ? { targetWordRange } : {}),
					...(sectionStatusValue ? { status: sectionStatusValue } : {}),
				})
				const { missing } = await referenceMgr.scanTexCitations()
				const { writingState, wordStatus, sectionInsights } = await buildWritingPayload(
					currentProject.templateId,
					missing,
				)
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project: updatedProject },
				})
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: {
						writingState,
						wordStatus,
						sectionInsights,
						targetWordRange,
						sectionStatusValue: sectionStatusValue ?? writingState.sectionStatus[sectionType],
						overLimit:
							targetWordRange && targetWordRange[1] > 0
								? (wordStatus[sectionType]?.wordCount ?? 0) > targetWordRange[1]
								: false,
					},
				})
				return
			}

			// ── Reference Management ──
			case "referenceList": {
				const entries = await referenceMgr.listEntries()
				const uncatalogued = await referenceMgr.scanUncataloguedPdfs()
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { entries, uncatalogued },
				})
				return
			}
			case "referenceScanTex": {
				const { cited, missing } = await referenceMgr.scanTexCitations()
				const entries = await referenceMgr.listEntries()
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { cited, missing, entries },
				})
				const workspaceState = await buildPaperWorkspaceState(provider, currentProject, {
					missingCitationKeys: missing,
					citedKeys: cited,
				})
				if (workspaceState) {
					await provider.postMessageToWebview({
						type: "paperProjectState",
						paperProjectState: {
							project: currentProject,
							workspaceState,
						},
					})
				}
				return
			}
			case "referenceGenerateBib": {
				const bibContent = await referenceMgr.generateBib()
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { bibGenerated: true, bibPreview: bibContent.substring(0, 500) },
				})
				return
			}
			case "referenceAdd": {
				const entry = (message as any).entry
				if (!entry) return
				const fullEntry = await referenceMgr.addEntry(entry)
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { addedEntry: fullEntry },
				})
				return
			}
			case "referenceRemove": {
				const citeKey = message.query as string
				if (!citeKey) return
				await referenceMgr.removeEntry(citeKey)
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { removed: citeKey },
				})
				return
			}
			case "referenceBatchImport": {
				const bibtexContent = text || ""
				if (!bibtexContent) return
				const result = await referenceMgr.batchImportBib(bibtexContent)
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { batchImport: result },
				})
				return
			}
			case "referenceScanPdf": {
				const uncatalogued = await referenceMgr.scanUncataloguedPdfs()
				await provider.postMessageToWebview({
					type: "paperReferenceState",
					paperReferenceState: { uncatalogued },
				})
				return
			}

			// ── Snapshots ──
			case "snapshotCreate": {
				const label = message.query as string | undefined
				const meta = await sectionMgr.createSnapshot(label)
				await provider.postMessageToWebview({
					type: "paperSnapshotState",
					paperSnapshotState: { snapshot: meta },
				})
				return
			}
			case "snapshotList": {
				const snapshots = await sectionMgr.listSnapshots()
				await provider.postMessageToWebview({
					type: "paperSnapshotState",
					paperSnapshotState: { snapshots },
				})
				return
			}
			case "snapshotRestore": {
				const snapshotId = message.query as string
				if (!snapshotId) return
				await sectionMgr.restoreSnapshot(snapshotId)
				await provider.postMessageToWebview({
					type: "paperSnapshotState",
					paperSnapshotState: { restored: snapshotId },
				})
				return
			}

			// ── Venue Switch ──
			case "venueSwitch": {
				const newTemplateId = message.query as string
				if (!newTemplateId) return
				const diff = await paperProject.previewVenueSwitch(newTemplateId)
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { venueSwitchPreview: diff, newTemplateId },
				})
				return
			}
			case "venueSwitchConfirm": {
				const newTemplateId = (message as any).newTemplateId as string
				if (!newTemplateId) return
				await paperProject.switchVenue(newTemplateId)
				await provider.postMessageToWebview({
					type: "paperProjectState",
					paperProjectState: { project: currentProject, venueSwitched: true },
				})
				return
			}

			// ── Markdown Export ──
			case "markdownExport": {
				if (!currentProject) return
				const md = await sectionMgr.exportToMarkdown(currentProject.templateId)
				await provider.postMessageToWebview({
					type: "paperWritingState",
					paperWritingState: { markdownExport: md },
				})
				return
			}
		}

		// If no action matched, fall through to legacy behavior (no state push)
	} catch (error) {
		provider.log(`Paper Writing error: ${error}`)
		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: { error: error instanceof Error ? error.message : String(error) },
		})
	}
}

export async function handlePaperWritingList(provider: ClineProvider): Promise<void> {
	try {
		const paperProject = provider.getPaperProjectManager()
		if (!paperProject) {
			await provider.postMessageToWebview({
				type: "paperProjectState",
				paperProjectState: { error: "Not initialized" },
			})
			return
		}

		const project = paperProject.getCurrentProject()
		if (project) {
			const sectionMgr = provider.getPaperSectionManager()
			const referenceMgr = provider.getReferenceManager()
			const entries = referenceMgr ? await referenceMgr.listEntries() : []
			const uncatalogued = referenceMgr ? await referenceMgr.scanUncataloguedPdfs() : []
			const citationStatus = referenceMgr ? await referenceMgr.scanTexCitations() : { cited: [], missing: [] }
			const snapshots = sectionMgr ? await sectionMgr.listSnapshots() : []
			const workspaceState = await buildPaperWorkspaceState(provider, project, {
				missingCitationKeys: citationStatus.missing,
				citedKeys: citationStatus.cited,
			})

			await provider.postMessageToWebview({
				type: "paperProjectState",
				paperProjectState: {
					project,
					referenceEntries: entries,
					uncatalogued,
					workspaceState,
				},
			})
			await provider.postMessageToWebview({
				type: "paperReferenceState",
				paperReferenceState: {
					entries,
					uncatalogued,
					cited: citationStatus.cited,
					missing: citationStatus.missing,
				},
			})
			await provider.postMessageToWebview({
				type: "paperSnapshotState",
				paperSnapshotState: { snapshots },
			})
		} else {
			await provider.postMessageToWebview({
				type: "paperProjectState",
				paperProjectState: { project: null },
			})
		}
	} catch (error) {
		provider.log(`Paper Writing list error: ${error}`)
	}
}

// ─── AI Text Revision (reuses singleCompletionHandler) ─────────────────

const AI_OP_PROMPTS: Record<string, (text: string, option?: string) => string> = {
	translate: (text, option) => {
		const lang = option || "Chinese"
		return `Translate the following academic text to ${lang}. Preserve all citations, figures, and table references. Return only the translated text:\n\n${text}`
	},
	rewrite: (text) =>
		`Rewrite the following academic text to improve clarity, flow, and impact while preserving the original meaning. Return only the rewritten text:\n\n${text}`,
	synonym: (text) =>
		`Replace words in the following text with more appropriate academic synonyms. Keep the sentence structure intact. Return only the revised text:\n\n${text}`,
	style: (text, option) => {
		const styleMap: Record<string, string> = {
			scientific: "more scientifically rigorous with precise terminology",
			precise: "more precise and specific, avoiding vague language",
			concise: "more concise and tight, removing redundancy",
		}
		const styleDesc = styleMap[option || ""] || "more scientifically rigorous and precise"
		return `Revise the following academic text to be ${styleDesc}. Return only the revised text:\n\n${text}`
	},
	rephrase: (text) =>
		`Rephrase the following text — express the same meaning using different wording and sentence structures. Return only the rephrased text:\n\n${text}`,
	abbreviate: (text) =>
		`Abbreviate the following text to a shorter version while retaining all key information. Return only the abbreviated text:\n\n${text}`,
	splitMerge: (text) =>
		`Improve the sentence structure of the following text: split overly long sentences and merge choppy short ones for better readability. Return only the revised text:\n\n${text}`,
	summarize: (text) =>
		`Summarize the following academic text concisely, capturing the main points and key findings. Return only the summary:\n\n${text}`,
	explain: (text) =>
		`Explain the following academic text in simpler terms, making it accessible to a broader scientific audience. Return only the explanation:\n\n${text}`,
	generateTitle: (text) =>
		`Generate a concise, descriptive academic title based on the following content. Return only the title:\n\n${text}`,
	generateAbstract: (text) =>
		`Write a structured academic abstract (background, methods, results, conclusions) based on the following content. Return only the abstract:\n\n${text}`,
	generateKeywords: (text) =>
		`Extract 5-8 relevant academic keywords from the following content, formatted as a comma-separated list. Return only the keywords:\n\n${text}`,
}

export async function handlePaperWritingAiOp(provider: ClineProvider, message: WebviewMessage): Promise<void> {
	try {
		const operation = (message.query as string) || ""
		const text = (message.text as string) || ""

		if (!operation || !text.trim()) return

		const [opName, opOption] = operation.split(":", 2)
		const promptFn = AI_OP_PROMPTS[opName]
		if (!promptFn) return

		const prompt = promptFn(text.trim(), opOption)

		const { apiConfiguration } = await provider.getState()
		const result = await singleCompletionHandler(apiConfiguration, prompt)

		// If this is a "section revise" operation, also save to file
		const sectionType = (message as any).sectionType as SectionType | undefined
		if (sectionType && result) {
			const sectionMgr = provider.getPaperSectionManager()
			if (sectionMgr) {
				await sectionMgr.saveSection(sectionType, result)
			}
		}

		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: {
				pendingResult: {
					operation: opName,
					originalText: text.trim(),
					resultText: result,
					sectionType: (message as any).sectionType as string | undefined,
				},
			},
		})
	} catch (error) {
		provider.log(`Paper Writing AI Op error: ${error}`)
		await provider.postMessageToWebview({
			type: "paperWritingState",
			paperWritingState: {
				error: error instanceof Error ? error.message : String(error),
			},
		})
	}
}
