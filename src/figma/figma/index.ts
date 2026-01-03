import type {
    GetFileResponse,
    GetFileNodesResponse,
    GetImagesResponse,
} from "@figma/rest-api-spec";
import type { FigmaAuthOptions } from "./interfaces";
import { FigmaAuth } from "./auth";
import { FigmaApiService } from "./services/api-service";
import { FigmaImageService, type ImageDownloadItem, type ImageDownloadOptions } from "./services/image-service";
import type { ImageProcessingResult } from "@shared/image";

export class FigmaClient {
    private readonly auth: FigmaAuth;
    private readonly apiService: FigmaApiService;
    private readonly imageService: FigmaImageService;

    constructor(options: FigmaAuthOptions) {
        this.auth = new FigmaAuth(options);
        this.apiService = new FigmaApiService(this.auth);
        this.imageService = new FigmaImageService(this.apiService);
    }

    async getRawFile(fileKey: string, depth?: number): Promise<GetFileResponse> {
        return this.apiService.getFile(fileKey, depth);
    }

    async getRawNode(fileKey: string, nodeId: string, depth?: number): Promise<GetFileNodesResponse> {
        const normalizedNodeId = nodeId.replace(/-/g, ":");
        const nodeIds = normalizedNodeId.split(";");
        return this.apiService.getNodes(fileKey, nodeIds, depth);
    }

    async getRawImages(
        fileKey: string,
        options: {
            ids: string[];
            format?: "png" | "svg";
            scale?: number;
            svg_include_id?: boolean;
            svg_simplify_stroke?: boolean;
        },
    ): Promise<GetImagesResponse> {
        return this.apiService.getImages(fileKey, options);
    }

    async downloadImages(
        fileKey: string,
        localPath: string,
        items: ImageDownloadItem[],
        options?: ImageDownloadOptions,
    ): Promise<ImageProcessingResult[]> {
        return this.imageService.downloadImages(fileKey, localPath, items, options);
    }
}

export type { FigmaAuthOptions } from "./interfaces";
export type { ImageDownloadItem, ImageDownloadOptions } from "./services/image-service";
