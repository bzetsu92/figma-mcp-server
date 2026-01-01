import { z } from "zod";
import { FigmaClient } from "~/figma";
import { Logger } from "~/logger";

const parameters = {
    fileKey: z
        .string()
        .regex(/^[a-zA-Z0-9]+$/, "File key must be alphanumeric")
        .describe("The key of the Figma file containing the images"),
    nodes: z
        .object({
            nodeId: z
                .string()
                .regex(
                    /^I?\d+[:|-]\d+(?:;\d+[:|-]\d+)*$/,
                    "Node ID must be like '1234:5678' or 'I5666:180910;1:10515;1:10336'",
                )
                .describe("The ID of the Figma image node to fetch, formatted as 1234:5678"),
            imageRef: z
                .string()
                .optional()
                .describe(
                    "If a node has an imageRef fill, you must include this variable. Leave blank when downloading Vector SVG images.",
                ),
            fileName: z
                .string()
                .regex(
                    /^[a-zA-Z0-9_.-]+\.(png|svg)$/,
                    "File names must contain only letters, numbers, underscores, dots, or hyphens, and end with .png or .svg.",
                )
                .describe(
                    "The local name for saving the fetched file, including extension. Either png or svg.",
                ),
            needsCropping: z
                .boolean()
                .optional()
                .describe("Whether this image needs cropping based on its transform matrix"),
            cropTransform: z
                .array(z.array(z.number()))
                .optional()
                .describe("Figma transform matrix for image cropping"),
            requiresImageDimensions: z
                .boolean()
                .optional()
                .describe("Whether this image requires dimension information for CSS variables"),
            filenameSuffix: z
                .string()
                .optional()
                .describe(
                    "Suffix to add to filename for unique cropped images, provided in the Figma data (e.g., 'abc123')",
                ),
        })
        .array()
        .describe("The nodes to fetch as images"),
    pngScale: z
        .number()
        .positive()
        .optional()
        .default(2)
        .describe(
            "Export scale for PNG images. Optional, defaults to 2 if not specified. Affects PNG images only.",
        ),
    localPath: z
        .string()
        .describe(
            "The absolute path to the directory where images are stored in the project. If the directory does not exist, it will be created. The format of this path should respect the directory format of the operating system you are running on. Don't use any special character escaping in the path name either.",
        ),
};

const parametersSchema = z.object(parameters);
export type DownloadImagesParams = z.infer<typeof parametersSchema>;

function addSuffixToFileName(fileName: string, suffix: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex !== -1) {
        const nameWithoutExt = fileName.substring(0, lastDotIndex);
        const ext = fileName.substring(lastDotIndex + 1);
        return `${nameWithoutExt}-${suffix}.${ext}`;
    }
    return `${fileName}-${suffix}`;
}

async function downloadFigmaImages(params: DownloadImagesParams, figmaClient: FigmaClient) {
    try {
        const { fileKey, nodes, localPath, pngScale = 2 } = parametersSchema.parse(params);

        const downloadItems: Array<{
            fileName: string;
            nodeId?: string;
            imageRef?: string;
            needsCropping: boolean;
            cropTransform?: number[][];
            requiresImageDimensions: boolean;
        }> = [];
        const downloadToRequests = new Map<number, string[]>();
        const seenDownloads = new Map<string, number>();

        for (const rawNode of nodes) {
            const { nodeId: rawNodeId, filenameSuffix, ...node } = rawNode;
            const nodeId = rawNodeId?.replace(/-/g, ":");
            const finalFileName = filenameSuffix && !node.fileName.includes(filenameSuffix)
                ? addSuffixToFileName(node.fileName, filenameSuffix)
                : node.fileName;

            const downloadItem = {
                fileName: finalFileName,
                needsCropping: node.needsCropping ?? false,
                cropTransform: node.cropTransform,
                requiresImageDimensions: node.requiresImageDimensions ?? false,
            };

            if (node.imageRef) {
                const uniqueKey = `${node.imageRef}-${filenameSuffix || "none"}`;

                if (!filenameSuffix && seenDownloads.has(uniqueKey)) {
                    const downloadIndex = seenDownloads.get(uniqueKey)!;
                    const requests = downloadToRequests.get(downloadIndex)!;
                    if (!requests.includes(finalFileName)) {
                        requests.push(finalFileName);
                    }
                    if (downloadItem.requiresImageDimensions) {
                        downloadItems[downloadIndex].requiresImageDimensions = true;
                    }
                } else {
                    const downloadIndex = downloadItems.length;
                    downloadItems.push({ ...downloadItem, imageRef: node.imageRef });
                    downloadToRequests.set(downloadIndex, [finalFileName]);
                    seenDownloads.set(uniqueKey, downloadIndex);
                }
            } else {
                const downloadIndex = downloadItems.length;
                downloadItems.push({ ...downloadItem, nodeId });
                downloadToRequests.set(downloadIndex, [finalFileName]);
            }
        }

        const allDownloads = await figmaClient.downloadImages(fileKey, localPath, downloadItems, {
            pngScale,
        });

        const imagesList = allDownloads
            .map((result, index) => {
                const fileName = result.filePath.split("/").pop() || result.filePath;
                const dimensions = `${result.finalDimensions.width}x${result.finalDimensions.height}`;
                const dimensionInfo = result.cssVariables
                    ? `${dimensions} | ${result.cssVariables}`
                    : dimensions;
                const cropStatus = result.wasCropped ? " (cropped)" : "";
                const requestedNames = downloadToRequests.get(index) || [fileName];
                const otherNames = requestedNames.filter((name) => name !== fileName);
                const aliasText = otherNames.length > 0 ? ` (also requested as: ${otherNames.join(", ")})` : "";

                return `- ${fileName}: ${dimensionInfo}${cropStatus}${aliasText}`;
            })
            .join("\n");

        return {
            content: [
                {
                    type: "text" as const,
                    text: `Downloaded ${allDownloads.length} images:\n${imagesList}`,
                },
            ],
        };
    } catch (error) {
        Logger.error(`Error downloading images from ${params.fileKey}:`, error);
        return {
            isError: true,
            content: [
                {
                    type: "text" as const,
                    text: `Failed to download images: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
}

export const downloadFigmaImagesTool = {
    name: "download_figma_images",
    description:
        "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes",
    parameters,
    handler: downloadFigmaImages,
} as const;
