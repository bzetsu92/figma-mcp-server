import type {
    GetFileResponse,
    GetFileNodesResponse,
    GetImagesResponse,
    GetImageFillsResponse,
} from "@figma/rest-api-spec";
import { fetchWithRetry } from "@shared/fetch";
import { Logger } from "~/logger";
import { FigmaAuth } from "../auth";

export class FigmaApiService {
    private readonly auth: FigmaAuth;
    private readonly baseUrl: string;

    constructor(auth: FigmaAuth, baseUrl = "https://api.figma.com/v1") {
        this.auth = auth;
        this.baseUrl = baseUrl;
    }

    async getFile(fileKey: string, depth?: number): Promise<GetFileResponse> {
        const params = new URLSearchParams();
        if (depth) params.append("depth", depth.toString());
        const url = `${this.baseUrl}/files/${fileKey}${params.toString() ? `?${params.toString()}` : ""}`;
        Logger.log(`Fetching file: ${fileKey}${depth ? ` (depth: ${depth})` : ""}`);

        return fetchWithRetry<GetFileResponse>(url, {
            headers: this.auth.getHeaders(),
        });
    }

    async getNodes(fileKey: string, nodeIds: string[], depth?: number): Promise<GetFileNodesResponse> {
        const params = new URLSearchParams();
        params.append("ids", nodeIds.join(","));
        if (depth) params.append("depth", depth.toString());
        const url = `${this.baseUrl}/files/${fileKey}/nodes?${params.toString()}`;
        Logger.log(`Fetching nodes: ${nodeIds.join(",")} from file ${fileKey}`);

        return fetchWithRetry<GetFileNodesResponse>(url, {
            headers: this.auth.getHeaders(),
        });
    }

    async getImages(fileKey: string, options: {
        ids: string[];
        format?: "png" | "svg";
        scale?: number;
        svg_include_id?: boolean;
        svg_simplify_stroke?: boolean;
    }): Promise<GetImagesResponse> {
        const params = new URLSearchParams();
        params.append("ids", options.ids.join(","));
        if (options.format) params.append("format", options.format);
        if (options.scale) params.append("scale", options.scale.toString());
        if (options.svg_include_id !== undefined) params.append("svg_include_id", String(options.svg_include_id));
        if (options.svg_simplify_stroke !== undefined) {
            params.append("svg_simplify_stroke", String(options.svg_simplify_stroke));
        }

        const url = `${this.baseUrl}/images/${fileKey}?${params.toString()}`;
        Logger.log(`Fetching images for file: ${fileKey}`);

        return fetchWithRetry<GetImagesResponse>(url, {
            headers: this.auth.getHeaders(),
        });
    }

    async getImageFills(fileKey: string): Promise<GetImageFillsResponse> {
        const url = `${this.baseUrl}/files/${fileKey}/images`;
        Logger.log(`Fetching image fills for file: ${fileKey}`);

        return fetchWithRetry<GetImageFillsResponse>(url, {
            headers: this.auth.getHeaders(),
        });
    }
}

