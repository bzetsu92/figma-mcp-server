import { getFigmaDataTool, downloadFigmaImagesTool } from "~/tools";

interface OpenAPISpec {
    openapi: string;
    info: {
        title: string;
        version: string;
        description: string;
    };
    servers: Array<{ url: string; description: string }>;
    paths: Record<string, unknown>;
    tags: Array<{ name: string; description: string }>;
}

interface ToolInfo {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
}

export function createOpenApiSpec(tools: ToolInfo[]): OpenAPISpec {
    const paths: Record<string, unknown> = {};

    tools.forEach((tool) => {
        const toolId = tool.name;
        const zodSchema = tool.parameters as Record<string, { _def?: { description?: string; typeName?: string } }>;
        const properties: Record<string, unknown> = {};
        const required: string[] = [];

        Object.entries(zodSchema).forEach(([key, schema]) => {
            const def = schema._def;
            if (!def) return;

            const zodType = def.typeName;
            let openApiType = "string";
            if (zodType === "ZodNumber") {
                openApiType = "number";
            } else if (zodType === "ZodBoolean") {
                openApiType = "boolean";
            }

            properties[key] = {
                type: openApiType,
                description: def.description || key,
            };

            if (zodType !== "ZodOptional") {
                required.push(key);
            }
        });

        paths[`/tools/${toolId}`] = {
            post: {
                summary: tool.description || tool.name,
                description: tool.description,
                operationId: toolId,
                tags: ["MCP Tools"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties,
                                required,
                            },
                        },
                    },
                },
                responses: {
                    "200": {
                        description: "Tool execution successful",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        content: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    type: { type: "string", enum: ["text"] },
                                                    text: { type: "string" },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "400": {
                        description: "Bad request",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        error: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        };
    });

    return {
        openapi: "3.0.0",
        info: {
            title: "Figma MCP Server API",
            version: "0.6.4",
            description: "Model Context Protocol server for Figma design data extraction",
        },
        servers: [
            {
                url: "http://localhost:3333",
                description: "Local development server",
            },
        ],
        paths: {
            "/health": {
                get: {
                    summary: "Health check",
                    operationId: "healthCheck",
                    tags: ["System"],
                    responses: {
                        "200": {
                            description: "Server is healthy",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string", example: "ok" },
                                            service: { type: "string", example: "figma-mcp-server" },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "/mcp": {
                post: {
                    summary: "MCP JSON-RPC endpoint",
                    description: "Main MCP protocol endpoint for tool calls",
                    operationId: "mcpRequest",
                    tags: ["MCP Protocol"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        jsonrpc: { type: "string", enum: ["2.0"] },
                                        method: { type: "string" },
                                        params: { type: "object" },
                                        id: { type: ["string", "number", "null"] },
                                    },
                                    required: ["jsonrpc", "method"],
                                },
                            },
                        },
                    },
                    responses: {
                        "200": {
                            description: "JSON-RPC response",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            jsonrpc: { type: "string", enum: ["2.0"] },
                                            result: { type: "object" },
                                            error: { type: "object" },
                                            id: { type: ["string", "number", "null"] },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            ...paths,
        },
        tags: [
            {
                name: "MCP Tools",
                description: "Figma data extraction and image download tools",
            },
            {
                name: "MCP Protocol",
                description: "Core MCP protocol endpoints",
            },
            {
                name: "System",
                description: "System health and documentation endpoints",
            },
        ],
    };
}

