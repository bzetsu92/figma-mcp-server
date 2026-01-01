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
};

const parametersSchema = z.object(parameters);
export type GetFigmaDataParams = z.infer<typeof parametersSchema>;

function formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    return JSON.stringify(error);
}

async function getFigmaData(
    params: GetFigmaDataParams,
    figmaClient: FigmaClient,
    outputFormat: "yaml" | "json",
) {
    try {
        const { fileKey, nodeId: rawNodeId, depth } = parametersSchema.parse(params);
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
        "Get comprehensive Figma file data including layout, content, visuals, and component information",
    parameters,
    handler: getFigmaData,
} as const;
