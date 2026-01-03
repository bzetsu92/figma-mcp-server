import { z } from "zod";
import { getFigmaDataTool } from "./get-figma-data-tool";
import { parseDocument } from "~/docs_parser";
import { buildPrompt } from "~/prompt_builder";
import type { FigmaClient } from "~/figma";
import type { FigmaScreenData, DocsData } from "~/prompt_builder/types";

function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } {
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
            "Figma design link or identifier. Can be: full URL (https://www.figma.com/design/...), fileKey:nodeId, or just fileKey. Example: 'https://www.figma.com/design/oXcy3FGjqSqYiiHJc3CA/...?node-id=1005-3058'"
        ),
    docPath: z
        .string()
        .optional()
        .describe(
            "Optional path to documentation file (PDF/DOCX/XLSX/TXT/MD) for additional context. If not provided, will check DOCS_PATH environment variable."
        ),
};

const parametersSchema = z.object(parameters);
export type CheckCodeParams = z.infer<typeof parametersSchema>;

async function checkCode(
    params: CheckCodeParams,
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

        const codePrompt = buildPrompt({ figma: figmaData, docs: docsData }, "code");
        
        const enhancedPrompt = `${codePrompt}

---

## 🔍 Code Review & Comparison Task

You are working inside **Cursor IDE** with access to the current source codebase.

Your task is to:
1. **Compare the Figma design** above with the **existing implementation** in the codebase
2. **Identify discrepancies** between design and code
3. **Check if components/fields match** the Figma specification
4. **Verify business rules** are implemented correctly
5. **Suggest improvements** or fixes if needed

### Comparison Checklist

✅ **Component Names**: Do component names in code match Figma components?
✅ **Field Names**: Do form field names match Figma fields exactly?
✅ **Validation Rules**: Are all business rules implemented?
✅ **User Flows**: Do the implemented flows match the described flows?
✅ **Role Permissions**: Are role-based access controls implemented correctly?

### Output Format

Provide a detailed comparison report in Markdown format:

\`\`\`markdown
# Code Review: {{SCREEN_NAME}}

## Design vs Implementation Comparison

### ✅ Matches
- [List what matches]

### ❌ Discrepancies
- [List what doesn't match]

### ⚠️ Missing Features
- [List missing features from design]

### 💡 Recommendations
- [Suggestions for improvements]
\`\`\`

Start by locating the relevant files for {{SCREEN_NAME}} in the codebase.`;

        return {
            content: [{ type: "text", text: enhancedPrompt.replace(/{{SCREEN_NAME}}/g, figmaData.screen) }],
        };
    } catch (error) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error generating code check prompt: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
}

export const checkCodeTool = {
    name: "check_code",
    description:
        "Check and compare code implementation against Figma design. Parses Figma link, optionally reads documentation, and generates code review prompt for Cursor to compare existing code with design. Usage: CD_{figma_link} or check_code with figmaLink parameter.",
    parameters,
    handler: checkCode,
} as const;

