import type { ImageProcessingResult } from "@shared/image";
import { downloadFigmaImage } from "@shared/common";
import { downloadAndProcessImage } from "@shared/image";
import { Logger, writeLogs } from "~/logger";
import { FigmaApiService } from "./api-service";

export interface ImageDownloadItem {
    fileName: string;
    nodeId?: string;
    imageRef?: string;
    needsCropping?: boolean;
    cropTransform?: number[][];
    requiresImageDimensions?: boolean;
}

export interface ImageDownloadOptions {
    pngScale?: number;
}

export class FigmaImageService {
    constructor(private readonly apiService: FigmaApiService) {}

    async downloadImages(
        fileKey: string,
        localPath: string,
        items: ImageDownloadItem[],
        options: ImageDownloadOptions = {},
    ): Promise<ImageProcessingResult[]> {
        const { pngScale = 2 } = options;

        const nodeItems = items.filter((item) => item.nodeId);
        const imageRefItems = items.filter((item) => item.imageRef);

        const allDownloads: ImageProcessingResult[] = [];

        if (nodeItems.length > 0) {
            const nodeIds = nodeItems.map((item) => item.nodeId!);
            const imagesResponse = await this.apiService.getImages(fileKey, {
                ids: nodeIds,
                format: "png",
                scale: pngScale,
            });

            for (const item of nodeItems) {
                const imageUrl = imagesResponse.images[item.nodeId!];
                if (!imageUrl) {
                    Logger.error(`No image URL found for node ${item.nodeId}`);
                    continue;
                }

                const result = await downloadAndProcessImage(
                    item.fileName,
                    localPath,
                    imageUrl,
                    item.needsCropping,
                    item.cropTransform,
                    item.requiresImageDimensions,
                );
                allDownloads.push(result);
            }
        }

        if (imageRefItems.length > 0) {
            const imageFillsResponse = await this.apiService.getImageFills(fileKey);
            const imageRefMap = imageFillsResponse.meta?.images || {};

            for (const item of imageRefItems) {
                const imageUrl = imageRefMap[item.imageRef!];
                if (!imageUrl) {
                    Logger.error(`No image URL found for imageRef ${item.imageRef}`);
                    continue;
                }

                const result = await downloadAndProcessImage(
                    item.fileName,
                    localPath,
                    imageUrl,
                    item.needsCropping,
                    item.cropTransform,
                    item.requiresImageDimensions,
                );
                allDownloads.push(result);
            }
        }

        writeLogs("figma-image-downloads.json", allDownloads);
        return allDownloads;
    }
}

