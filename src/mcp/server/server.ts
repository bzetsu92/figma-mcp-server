import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { FigmaAuthOptions } from "~/figma";
import { FigmaClient } from "~/figma";
import { Logger } from "~/logger";
import {
    downloadFigmaImagesTool,
    getFigmaDataTool,
    type DownloadImagesParams,
    type GetFigmaDataParams,
} from "../../tools";

export interface McpServerOptions {
    isHTTP?: boolean;
    outputFormat?: "yaml" | "json";
    skipImageDownloads?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<McpServerOptions, "isHTTP">> = {
    outputFormat: "yaml",
    skipImageDownloads: false,
};

export class FigmaMcpServer {
    private readonly server: McpServer;
    private readonly figmaClient: FigmaClient;
    private readonly options: Required<McpServerOptions>;

    constructor(authOptions: FigmaAuthOptions, options: McpServerOptions = {}) {
        const serverInfo = {
            name: "Figma MCP Server",
            version: process.env.NPM_PACKAGE_VERSION ?? "unknown",
        };

        this.server = new McpServer(serverInfo);
        this.figmaClient = new FigmaClient(authOptions);
        this.options = {
            isHTTP: options.isHTTP ?? false,
            outputFormat: options.outputFormat ?? DEFAULT_OPTIONS.outputFormat,
            skipImageDownloads: options.skipImageDownloads ?? DEFAULT_OPTIONS.skipImageDownloads,
        };

        this.registerTools();
        Logger.isHTTP = this.options.isHTTP;
    }

    private registerTools(): void {
        this.server.tool(
            getFigmaDataTool.name,
            getFigmaDataTool.description,
            getFigmaDataTool.parameters,
            (params: GetFigmaDataParams) =>
                getFigmaDataTool.handler(params, this.figmaClient, this.options.outputFormat),
        );

        if (!this.options.skipImageDownloads) {
            this.server.tool(
                downloadFigmaImagesTool.name,
                downloadFigmaImagesTool.description,
                downloadFigmaImagesTool.parameters,
                (params: DownloadImagesParams) => downloadFigmaImagesTool.handler(params, this.figmaClient),
            );
        }
    }

    getServer(): McpServer {
        return this.server;
    }

    getFigmaClient(): FigmaClient {
        return this.figmaClient;
    }
}

