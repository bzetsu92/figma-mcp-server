import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Logger } from "~/logger";
import { FigmaMcpServer } from "./server";
import { getServerConfig } from "~/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpRouter } from "../router";

interface HttpServerState {
    server: Server;
    transports: {
        streamable: Record<string, StreamableHTTPServerTransport>;
        sse: Record<string, SSEServerTransport>;
    };
}

let httpServerState: HttpServerState | null = null;

export async function startServer(): Promise<void> {
    const isStdioMode = process.env.NODE_ENV === "cli" || process.argv.includes("--stdio");

    const config = getServerConfig(isStdioMode);

    const mcpServer = new FigmaMcpServer(config.auth, {
        isHTTP: !isStdioMode,
        outputFormat: config.outputFormat,
        skipImageDownloads: config.skipImageDownloads,
    });
    const server = mcpServer.getServer();

    if (isStdioMode) {
        const transport = new StdioServerTransport();
        await server.connect(transport);
    } else {
        console.log(`Initializing Figma MCP Server in HTTP mode on port ${config.port}...`);
        await startHttpServer(config.port, server, config.skipImageDownloads);
    }
}

export async function startHttpServer(port: number, mcpServer: McpServer, skipImageDownloads: boolean = false): Promise<void> {
    if (httpServerState) {
        throw new Error("HTTP server is already running. Call stopHttpServer() first.");
    }

    const app = express();
    const transports = {
        streamable: {} as Record<string, StreamableHTTPServerTransport>,
        sse: {} as Record<string, SSEServerTransport>,
    };

    app.use(express.json());
    
    const mcpRouter = createMcpRouter(skipImageDownloads);
    app.use(mcpRouter);

    app.post("/mcp", async (req, res) => {
        Logger.log("Received StreamableHTTP request");
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const isInitialize = isInitializeRequest(req.body);
        Logger.log(`Request details: sessionId=${sessionId || "none"}, isInitialize=${isInitialize}, method=${req.body?.method || "unknown"}`);
        
        let transport: StreamableHTTPServerTransport;

        if (sessionId && transports.streamable[sessionId]) {
            Logger.log("Reusing existing StreamableHTTP transport for sessionId", sessionId);
            transport = transports.streamable[sessionId];
        } else if (!sessionId && isInitialize) {
            Logger.log("New initialization request for StreamableHTTP");
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    Logger.log(`Session initialized with ID: ${newSessionId}`);
                    transports.streamable[newSessionId] = transport;
                },
            });
            transport.onclose = () => {
                if (transport.sessionId) {
                    Logger.log(`Session closed: ${transport.sessionId}`);
                    delete transports.streamable[transport.sessionId];
                }
            };
            await mcpServer.connect(transport);
        } else {
            Logger.log(`Invalid request - sessionId: ${sessionId || "none"}, isInitialize: ${isInitialize}, body:`, JSON.stringify(req.body, null, 2));
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32000,
                    message: "Bad Request: No valid session ID provided",
                },
                id: null,
            });
            return;
        }

        let progressInterval: NodeJS.Timeout | null = null;
        const progressToken = req.body.params?._meta?.progressToken;
        let progress = 0;
        if (progressToken) {
            Logger.log(
                `Setting up progress notifications for token ${progressToken} on session ${sessionId}`,
            );
            progressInterval = setInterval(async () => {
                Logger.log("Sending progress notification", progress);
                await mcpServer.server.notification({
                    method: "notifications/progress",
                    params: {
                        progress,
                        progressToken,
                    },
                });
                progress++;
            }, 1000);
        }

        try {
            Logger.log("Handling StreamableHTTP request");
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            Logger.error("Error handling StreamableHTTP request:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "Internal error",
                    },
                    id: req.body?.id ?? null,
                });
            }
        } finally {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            Logger.log("StreamableHTTP request handled");
        }
    });

    const handleSessionRequest = async (req: Request, res: Response) => {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        if (!sessionId || !transports.streamable[sessionId]) {
            res.status(400).send("Invalid or missing session ID");
            return;
        }

        Logger.log(`Received session termination request for session ${sessionId}`);

        try {
            const transport = transports.streamable[sessionId];
            await transport.handleRequest(req, res);
        } catch (error) {
            Logger.error("Error handling session termination:", error);
            if (!res.headersSent) {
                res.status(500).send("Error processing session termination");
            }
        }
    };

    app.get("/mcp", handleSessionRequest);
    app.delete("/mcp", handleSessionRequest);

    app.get("/sse", async (req, res) => {
        try {
            Logger.log("Establishing new SSE connection");
            const transport = new SSEServerTransport("/messages", res);
            Logger.log(`New SSE connection established for sessionId ${transport.sessionId}`);

            transports.sse[transport.sessionId] = transport;
            res.on("close", () => {
                delete transports.sse[transport.sessionId];
            });

            await mcpServer.connect(transport);
        } catch (error) {
            Logger.error("Error establishing SSE connection:", error);
            if (!res.headersSent) {
                res.status(500).send("Error establishing SSE connection");
            }
        }
    });

    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId as string;
        if (!sessionId) {
            res.status(400).send("Missing sessionId parameter");
            return;
        }

        const transport = transports.sse[sessionId];
        if (!transport) {
            res.status(400).send(`No transport found for sessionId ${sessionId}`);
            return;
        }

        try {
            Logger.log(`Received SSE message for sessionId ${sessionId}`);
            await transport.handlePostMessage(req, res);
        } catch (error) {
            Logger.error(`Error handling SSE message for sessionId ${sessionId}:`, error);
            if (!res.headersSent) {
                res.status(500).send("Error processing message");
            }
        }
    });

    const server = app.listen(port, "127.0.0.1", () => {
        Logger.log(`HTTP server listening on port ${port}`);
        Logger.log(`Swagger UI: http://localhost:${port}/docs`);
        Logger.log(`OpenAPI spec: http://localhost:${port}/openapi.json`);
        Logger.log(`Health check: http://localhost:${port}/health`);
        Logger.log(`SSE endpoint: http://localhost:${port}/sse`);
        Logger.log(`Message endpoint: http://localhost:${port}/messages`);
        Logger.log(`StreamableHTTP endpoint: http://localhost:${port}/mcp`);
    });

    httpServerState = { server, transports };

    if (!process.listenerCount("SIGINT")) {
        process.on("SIGINT", async () => {
            Logger.log("Shutting down server...");
            if (httpServerState) {
                await closeTransports(httpServerState.transports.sse);
                await closeTransports(httpServerState.transports.streamable);
            }
            Logger.log("Server shutdown complete");
            process.exit(0);
        });
    }
}

async function closeTransports(
    transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport>,
) {
    for (const sessionId in transports) {
        try {
            await transports[sessionId]?.close();
            delete transports[sessionId];
        } catch (error) {
            console.error(`Error closing transport for session ${sessionId}:`, error);
        }
    }
}

export async function stopHttpServer(): Promise<void> {
    if (!httpServerState) {
        throw new Error("HTTP server is not running");
    }

    const { server, transports: serverTransports } = httpServerState;

    return new Promise((resolve, reject) => {
        server.close((err: Error | undefined) => {
            if (err) {
                reject(err);
                return;
            }

            const closingPromises = [
                ...Object.values(serverTransports.sse).map((transport) => transport.close()),
                ...Object.values(serverTransports.streamable).map((transport) => transport.close()),
            ];

            Promise.all(closingPromises)
                .then(() => {
                    httpServerState = null;
                    resolve();
                })
                .catch((error) => {
                    httpServerState = null;
                    reject(error);
                });
        });
    });
}
