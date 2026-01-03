export { runPipeline } from "./pipeline";
export * from "./types";
export { extractRulesAndFlows } from "./extractRulesAndFlows";

import { runPipeline } from "./pipeline";
import { extractRulesAndFlows } from "./extractRulesAndFlows";
import type { ScreenContext, ParsedDocsData } from "./types";

export async function parseDocument(
    filePath: string,
    screenContext?: ScreenContext
): Promise<ParsedDocsData> {
    try {
        const document = await runPipeline(filePath, { includePromptReady: false });
        const fullText = document.sections.map((s) => `${s.heading || ""}\n${s.content}`).join("\n\n");
        return await extractRulesAndFlows(fullText, document.facts || [], screenContext);
    } catch (error) {
        throw new Error(`Failed to parse document: ${error instanceof Error ? error.message : String(error)}`);
    }
}

