import type { FigmaAuthOptions } from "~/figma";
import { FigmaMcpServer, type McpServerOptions } from "./server/server";

export function createServer(
    authOptions: FigmaAuthOptions,
    options: McpServerOptions = {},
) {
    const mcpServer = new FigmaMcpServer(authOptions, options);
    return mcpServer.getServer();
}

export { startServer, startHttpServer, stopHttpServer } from "./server";
export type { FigmaClient as FigmaService } from "~/figma";
export { getServerConfig } from "~/config";
export type { McpServerOptions } from "./server/server";
export { createMcpRouter } from "./router";
