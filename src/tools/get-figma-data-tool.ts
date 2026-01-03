import { z } from "zod";
import fs from "fs";
import { FigmaClient } from "~/figma";
import {
    simplifyRawFigmaObject,
    allExtractors,
    collapseSvgContainers,
} from "@extractors/index";
import yaml from "js-yaml";
import { Logger, writeLogs } from "~/logger";
import type { ExtractedNode } from "@extractors/types";

const parameters = {
    fileKey: z
        .string()
        .regex(/^[a-zA-Z0-9]+$/, "File key must be alphanumeric")
        .describe(
            "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
        ),
    nodeId: z
        .string()
        .regex(
            /^I?\d+[:|-]\d+(?:;\d+[:|-]\d+)*$/,
            "Node ID must be like '1234:5678' or 'I5666:180910;1:10515;1:10336'",
        )
        .optional()
        .describe(
            "The ID of the node to fetch, often found as URL parameter node-id=<nodeId>, always use if provided. Use format '1234:5678' or 'I5666:180910;1:10515;1:10336' for multiple nodes.",
        ),
    depth: z
        .number()
        .optional()
        .describe(
            "OPTIONAL. Do NOT use unless explicitly requested by the user. Controls how many levels deep to traverse the node tree.",
        ),
    simplified: z
        .boolean()
        .optional()
        .default(false)
        .describe(
            "If true, returns simplified screen data (screen name, components, fields, actions) instead of full design data. Use this for prompt building.",
        ),
};

const parametersSchema = z.object(parameters);
export type GetFigmaDataParams = z.infer<typeof parametersSchema>;

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return JSON.stringify(error);
}

interface SimplifiedScreenData {
    screen: string;
    components: string[];
    fields: Array<{ name: string; type: string }>;
    actions: string[];
}

function extractFieldsFromNodes(nodes: ExtractedNode[]): Array<{ name: string; type: string }> {
    const fields: Array<{ name: string; type: string }> = [];
    
    function traverse(node: ExtractedNode) {
        if (node.isInput || node.inputType) {
            const fieldName = node.name || node.text || "unnamed";
            const fieldType = node.inputType || 
                            (node.name?.toLowerCase().includes("password") ? "password" : "text");
            fields.push({ name: fieldName, type: fieldType });
        }
        
        if (node.text) {
            const textLower = node.text.toLowerCase();
            if (textLower.includes("email") || textLower.includes("@")) {
                fields.push({ name: "email", type: "text" });
            }
            if (textLower.includes("password")) {
                fields.push({ name: "password", type: "password" });
            }
        }
        
        if (node.componentProperties) {
            for (const prop of node.componentProperties) {
                if (prop.type === "TEXT" || prop.type === "BOOLEAN") {
                    const propName = prop.name.toLowerCase();
                    if (propName.includes("input") || propName.includes("field") || 
                        propName.includes("email") || propName.includes("password")) {
                        fields.push({
                            name: prop.name,
                            type: prop.type === "BOOLEAN" ? "checkbox" : "text"
                        });
                    }
                }
            }
        }
        
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    
    nodes.forEach(traverse);
    return Array.from(new Map(fields.map(f => [f.name, f])).values());
}

function extractComponentsFromNodes(nodes: ExtractedNode[]): string[] {
    const components = new Set<string>();
    
    function traverse(node: ExtractedNode) {
        if (node.componentId) {
            components.add(node.name || "UnnamedComponent");
        }
        
        const name = node.name?.toLowerCase() || "";
        if (name.includes("button") || name.includes("input") || 
            name.includes("select") || name.includes("checkbox") ||
            name.includes("form") || name.includes("field")) {
            components.add(node.name || "UnnamedComponent");
        }
        
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    
    nodes.forEach(traverse);
    return Array.from(components);
}

function extractActionsFromNodes(nodes: ExtractedNode[]): string[] {
    const actions = new Set<string>();
    
    function traverse(node: ExtractedNode) {
        const name = node.name?.toLowerCase() || "";
        const text = node.text?.toLowerCase() || "";
        
        if (name.includes("submit") || text.includes("submit") || 
            name.includes("login") || text.includes("login") ||
            name.includes("save") || text.includes("save")) {
            actions.add("submit");
        }
        
        if (name.includes("button") || name.includes("click") || 
            node.type === "INSTANCE" && name.includes("btn")) {
            actions.add("click");
        }
        
        if (name.includes("navigate") || name.includes("link") || 
            name.includes("route") || text.includes("go to") ||
            text.includes("navigate")) {
            actions.add("navigation");
        }
        
        if (node.children) {
            node.children.forEach(traverse);
        }
    }
    
    nodes.forEach(traverse);
    return Array.from(actions);
}

async function getFigmaData(
    params: GetFigmaDataParams,
    figmaClient: FigmaClient,
    outputFormat: "yaml" | "json",
) {
    try {
        const { fileKey, nodeId: rawNodeId, depth, simplified } = parametersSchema.parse(params);
        const nodeId = rawNodeId?.replace(/-/g, ":");

        Logger.log(
            `Fetching ${depth ? `${depth} layers deep` : "all layers"} of ${
                nodeId ? `node ${nodeId} from file` : `full file`
            } ${fileKey}`,
        );

        const rawApiResponse = nodeId
            ? await figmaClient.getRawNode(fileKey, nodeId, depth)
            : await figmaClient.getRawFile(fileKey, depth);

        const simplifiedDesign = simplifyRawFigmaObject(rawApiResponse, allExtractors, {
            maxDepth: depth,
            afterChildren: collapseSvgContainers,
        });

        writeLogs("figma-simplified.json", simplifiedDesign);

        Logger.log(
            `Successfully extracted data: ${simplifiedDesign.nodes.length} nodes, ${
                Object.keys(simplifiedDesign.globalVars.styles).length
            } styles`,
        );

        let screenshotUrls: Record<string, string> = {};
        if (nodeId) {
            try {
                const nodeIds = nodeId.split(";");
                const imagesResponse = await figmaClient.getRawImages(fileKey, {
                    ids: nodeIds,
                    format: "png",
                    scale: 2,
                });

                if (imagesResponse.images) {
                    for (const [key, value] of Object.entries(imagesResponse.images)) {
                        if (value) {
                            screenshotUrls[key] = value;
                        }
                    }
                }
                Logger.log(`Fetched ${Object.keys(screenshotUrls).length} screenshot(s) for visual analysis`);
            } catch (imageError) {
                Logger.log(`Could not fetch screenshot for visual analysis: ${imageError}`);
            }
        }

        if (simplified) {
            const screenName = simplifiedDesign.name || 
                              simplifiedDesign.nodes[0]?.name || 
                              "UnknownScreen";
            
            const components = extractComponentsFromNodes(simplifiedDesign.nodes);
            const fields = extractFieldsFromNodes(simplifiedDesign.nodes);
            const actions = extractActionsFromNodes(simplifiedDesign.nodes);
            
            const simplifiedResult: SimplifiedScreenData = {
                screen: screenName,
                components,
                fields,
                actions,
            };
            
            Logger.log(
                `Successfully extracted simplified screen data: ${simplifiedResult.screen}, ${simplifiedResult.components.length} components, ${simplifiedResult.fields.length} fields, ${simplifiedResult.actions.length} actions`,
            );
            
            return {
                content: [{ type: "text" as const, text: JSON.stringify(simplifiedResult, null, 2) }],
            };
        }

        const { nodes, globalVars, ...metadata } = simplifiedDesign;
        const result = {
            metadata,
            nodes,
            globalVars,
            screenshots: screenshotUrls,
        };

        const enableLogs = process.env.FIGMA_ENABLE_LOGS === "true" || process.env.ENABLE_FIGMA_LOGS === "true";
        if (enableLogs) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const logFileName = `figma-vlm-data-${fileKey}-${nodeId || "full"}-${timestamp}.json`;
            try {
                const logsDir = "src/logs";
                if (!fs.existsSync(logsDir)) {
                    fs.mkdirSync(logsDir, { recursive: true });
                }
                const logPath = `${logsDir}/${logFileName}`;
                fs.writeFileSync(logPath, JSON.stringify(result, null, 2));
                Logger.log(`Saved Figma + VLM data to: ${logPath}`);
            } catch (logError) {
                Logger.log(`Could not save VLM data log: ${logError}`);
            }
        }

        const formattedResult =
            outputFormat === "json" ? JSON.stringify(result, null, 2) : yaml.dump(result);

        return {
            content: [{ type: "text" as const, text: formattedResult }],
        };
    } catch (error) {
        const message = formatError(error);
        Logger.error(`Error fetching file ${params.fileKey}:`, message);
        return {
            isError: true,
            content: [{ type: "text" as const, text: `Error fetching file: ${message}` }],
        };
    }
}

export const getFigmaDataTool = {
    name: "get_figma_data",
    description:
        "Get Figma file data. Use simplified=true for screen data (screen name, components, fields, actions) for prompt building. Use simplified=false (default) for comprehensive design data including layout, content, visuals, and component information.",
    parameters,
    handler: getFigmaData,
} as const;
