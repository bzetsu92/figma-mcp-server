import { z } from "zod";
import { getFigmaDataTool } from "./get-figma-data-tool";
import { parseDocument } from "~/docs_parser";
import { buildPrompt } from "~/prompt_builder";
import type { FigmaClient } from "~/figma";
import type { FigmaScreenData, DocsData } from "~/prompt_builder/types";

// Parse Figma URL to extract fileKey and nodeId
function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
	// Support formats:
	// - https://www.figma.com/design/oXcy3FGjqSqYiiHJc3CA/...?node-id=1005-3058
	// - https://www.figma.com/file/oXcy3FGjqSqYiiHJc3CA/...
	// - oXcy3FGjqSqYiiHJc3CA (just fileKey)
	// - oXcy3FGjqSqYiiHJc3CA:1005-3058 (fileKey:nodeId)

	const urlMatch = url.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/);
	if (urlMatch) {
		const fileKey = urlMatch[1];
		const nodeIdMatch = url.match(/node-id=([^&]+)/);
		const nodeId = nodeIdMatch ? nodeIdMatch[1].replace(/-/g, ":") : undefined;
		return { fileKey, nodeId };
	}

	const colonMatch = url.match(/^([a-zA-Z0-9]+)[:-](.+)$/);
	if (colonMatch) {
		return { fileKey: colonMatch[1], nodeId: colonMatch[2].replace(/-/g, ":") };
	}

	if (/^[a-zA-Z0-9]+$/.test(url)) {
		return { fileKey: url };
	}

	throw new Error(`Invalid Figma URL or identifier: ${url}`);
}

const parameters = {
	figmaLink: z
		.string()
		.describe(
			"Figma design link or identifier. Can be: full URL (https://www.figma.com/design/...), fileKey:nodeId, or just fileKey. Example: 'https://www.figma.com/design/oXcy3FGjqSqYiiHJc3CA/...?node-id=1005-3058' or 'oXcy3FGjqSqYiiHJc3CA:1005-3058'"
		),
	docPath: z
		.string()
		.optional()
		.describe(
			"Optional path to documentation file (PDF/DOCX/XLSX/TXT/MD) for additional context. If not provided, will check DOCS_PATH environment variable."
		),
};

const parametersSchema = z.object(parameters);
export type GenerateUTParams = z.infer<typeof parametersSchema>;

async function generateUT(
	params: GenerateUTParams,
	figmaClient: FigmaClient,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
	try {
		const { fileKey, nodeId } = parseFigmaUrl(params.figmaLink);

		const figmaResult = await getFigmaDataTool.handler(
			{ fileKey, nodeId, simplified: true },
			figmaClient,
			"json"
		);

		if (figmaResult.isError) {
			return {
				isError: true,
				content: [{ type: "text", text: `Error fetching Figma data: ${figmaResult.content[0].text}` }],
			};
		}

		const figmaData: FigmaScreenData = JSON.parse(figmaResult.content[0].text);

		const docPath = params.docPath || process.env.DOCS_PATH;
		let docsData: DocsData = { rules: [], flows: [] };

		if (docPath) {
			try {
				const parsedDocs = await parseDocument(docPath, {
					screen: figmaData.screen,
					components: figmaData.components,
					fields: figmaData.fields,
					actions: figmaData.actions,
				});
				docsData = {
					rules: parsedDocs.rules,
					flows: parsedDocs.flows,
					facts: parsedDocs.facts,
					roles: parsedDocs.roles,
				};
			} catch (error) {
				console.warn(`Warning: Could not parse docs from ${docPath}:`, error);
			}
		}

		const prompt = buildPrompt({ figma: figmaData, docs: docsData }, "ut");

		return {
			content: [{ type: "text", text: prompt }],
		};
	} catch (error) {
		return {
			isError: true,
			content: [
				{
					type: "text",
					text: `Error generating UT prompt: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
		};
	}
}

export const generateUTTool = {
	name: "generate_ut",
	description:
		"Generate unit test cases for a Figma screen. Parses Figma link, optionally reads documentation for context, and generates comprehensive unit test prompt for Cursor. Usage: UT_{figma_link} or generate_ut with figmaLink parameter.",
	parameters,
	handler: generateUT,
} as const;

