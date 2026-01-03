import express, { type Router } from "express";
import swaggerUi from "swagger-ui-express";
import { createOpenApiSpec } from "./openapi";
import { getFigmaDataTool, downloadFigmaImagesTool, generateUTTool, checkCodeTool } from "~/tools";
import { FigmaClient } from "~/figma";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

export function createMcpRouter(skipImageDownloads: boolean): Router {
    const router = express.Router();

    const tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }> = [
        {
            name: getFigmaDataTool.name,
            description: getFigmaDataTool.description,
            parameters: getFigmaDataTool.parameters,
        },
        {
            name: generateUTTool.name,
            description: generateUTTool.description,
            parameters: generateUTTool.parameters,
        },
        {
            name: checkCodeTool.name,
            description: checkCodeTool.description,
            parameters: checkCodeTool.parameters,
        },
    ];

    if (!skipImageDownloads) {
        tools.push({
            name: downloadFigmaImagesTool.name,
            description: downloadFigmaImagesTool.description,
            parameters: downloadFigmaImagesTool.parameters,
        });
    }

    const openApiSpec = createOpenApiSpec(tools);

    router.use("/docs", swaggerUi.serve);
    router.get("/docs", swaggerUi.setup(openApiSpec));

    router.get("/openapi.json", (_req, res) => {
        res.json(openApiSpec);
    });

    router.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "figma-mcp-server" });
    });

    router.post("/test/get-figma-data", async (req, res) => {
        try {
            const { fileKey, nodeId, simplified } = req.body;
            
            if (!fileKey) {
                return res.status(400).json({ error: "fileKey is required" });
            }

            const figmaApiKey = process.env.FIGMA_API_KEY;
            if (!figmaApiKey) {
                return res.status(500).json({ error: "FIGMA_API_KEY not configured" });
            }

            const figmaClient = new FigmaClient({
                figmaApiKey,
                figmaOAuthToken: "",
                useOAuth: false,
            });

            const result = await getFigmaDataTool.handler(
                { fileKey, nodeId, simplified: simplified === true },
                figmaClient,
                "json",
            );

            if (result.isError) {
                return res.status(500).json({ error: result.content[0].text });
            }

            const data = JSON.parse(result.content[0].text);
            res.json(data);
        } catch (error) {
            res.status(500).json({ 
                error: error instanceof Error ? error.message : String(error) 
            });
        }
    });

    return router;
}

