import { config } from "dotenv";
import { Logger } from "../logger.js";

const isVerbose = process.env.FIGMA_TEST_VERBOSE === "true";
const originalLog = Logger.log;
const originalError = Logger.error;

if (!isVerbose) {
    Logger.log = () => {};
    Logger.error = () => {};
}

config();

import { createServer } from "../../mcp/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import yaml from "js-yaml";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

describe("Figma MCP Server Tests", () => {
    let server: McpServer;
    let client: Client;
    let figmaApiKey: string;
    let figmaFileKey: string;

    beforeAll(async () => {
        figmaApiKey = process.env.FIGMA_API_KEY || "";
        figmaFileKey = process.env.FIGMA_FILE_KEY || "";

        if (!figmaApiKey || !figmaFileKey) {
            console.warn(
                "⚠️  Integration tests require FIGMA_API_KEY and FIGMA_FILE_KEY environment variables.\n" +
                "   Set them in .env file or export them before running tests.\n" +
                "   See env.example for reference.\n" +
                "   Skipping all integration tests..."
            );
            return;
        }

        server = createServer({
            figmaApiKey,
            figmaOAuthToken: "",
            useOAuth: false,
        });

        client = new Client(
            {
                name: "figma-test-client",
                version: "1.0.0",
            },
            {
                capabilities: {},
            },
        );

        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

        await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    });

    afterAll(async () => {
        await client.close();
        
        if (!isVerbose) {
            Logger.log = originalLog;
            Logger.error = originalError;
        }
    });

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    describe("Get Figma Data", () => {
        it("should be able to get Figma file data", async () => {
            if (!figmaApiKey || !figmaFileKey) {
                console.warn("Skipping test: FIGMA_API_KEY or FIGMA_FILE_KEY not set");
                return;
            }

            const args: any = {
                fileKey: figmaFileKey,
            };

            const result = await client.request(
                {
                    method: "tools/call",
                    params: {
                        name: "get_figma_data",
                        arguments: args,
                    },
                },
                CallToolResultSchema,
            );

            if (result.isError) {
                const errorText = result.content[0]?.type === "text" 
                    ? (result.content[0] as { type: "text"; text: string }).text 
                    : "";
                if (errorText.includes("429") || errorText.includes("Too Many Requests")) {
                    if (isVerbose) {
                        console.warn("Rate limited (429), skipping test");
                    }
                    return;
                }
            }

            expect(result.isError).toBeFalsy();
            expect(result.content[0]).toBeDefined();
            expect(result.content[0].type).toBe("text");
            const content = (result.content[0] as { type: "text"; text: string }).text;
            const parsed = yaml.load(content) as any;

            expect(parsed).toBeDefined();
            expect(parsed.nodes).toBeDefined();
            expect(Array.isArray(parsed.nodes)).toBe(true);
            
            await delay(5000);
        }, 60000);

        it("should return error for invalid fileKey", async () => {
            if (!figmaApiKey) {
                console.warn("Skipping test: FIGMA_API_KEY not set");
                return;
            }

            const args: any = {
                fileKey: "invalid-file-key-12345",
            };

            const result = await client.request(
                {
                    method: "tools/call",
                    params: {
                        name: "get_figma_data",
                        arguments: args,
                    },
                },
                CallToolResultSchema,
            );

            expect(result.isError).toBe(true);
            expect(result.content[0]?.type).toBe("text");
        }, 30000);
    });
});
