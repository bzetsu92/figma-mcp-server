import { config as loadEnv } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolve } from "path";
import type { FigmaAuthOptions } from "~/figma";

export interface ServerConfig {
    auth: FigmaAuthOptions;
    port: number;
    outputFormat: "yaml" | "json";
    skipImageDownloads?: boolean;
    configSources: {
        figmaApiKey: "cli" | "env";
        figmaOAuthToken: "cli" | "env" | "none";
        port: "cli" | "env" | "default";
        outputFormat: "cli" | "env" | "default";
        envFile: "cli" | "default";
        skipImageDownloads?: "cli" | "env" | "default";
    };
}

interface CliArgs {
    "figma-api-key"?: string;
    "figma-oauth-token"?: string;
    env?: string;
    port?: number;
    json?: boolean;
    "skip-image-downloads"?: boolean;
}

function maskApiKey(key: string): string {
    if (!key || key.length <= 4) return "****";
    return `****${key.slice(-4)}`;
}

export function getServerConfig(isStdioMode: boolean): ServerConfig {
    const argv = yargs(hideBin(process.argv))
        .options({
            "figma-api-key": {
                type: "string",
                description: "Figma API key (Personal Access Token)",
            },
            "figma-oauth-token": {
                type: "string",
                description: "Figma OAuth Bearer token",
            },
            env: {
                type: "string",
                description: "Path to custom .env file to load environment variables from",
            },
            port: {
                type: "number",
                description: "Port to run the server on",
            },
            json: {
                type: "boolean",
                description: "Output data from tools in JSON format instead of YAML",
                default: false,
            },
            "skip-image-downloads": {
                type: "boolean",
                description:
                    "Do not register the download_figma_images tool (skip image downloads)",
                default: false,
            },
        })
        .parseSync() as CliArgs;

    let envFilePath: string;
    let envFileSource: "cli" | "default";

    if (argv["env"]) {
        envFilePath = resolve(argv["env"]);
        envFileSource = "cli";
    } else {
        envFilePath = resolve(process.cwd(), ".env");
        envFileSource = "default";
    }

    loadEnv({ path: envFilePath, override: true });

    const auth: FigmaAuthOptions = {
        figmaApiKey: "",
        figmaOAuthToken: "",
        useOAuth: false,
    };

    const config: Omit<ServerConfig, "auth"> = {
        port: 3333,
        outputFormat: "yaml",
        skipImageDownloads: false,
        configSources: {
            figmaApiKey: "env",
            figmaOAuthToken: "none",
            port: "default",
            outputFormat: "default",
            envFile: envFileSource,
            skipImageDownloads: "default",
        },
    };

    const figmaApiKeySource = argv["figma-api-key"] ? "cli" : process.env.FIGMA_API_KEY ? "env" : "default";
    const figmaOAuthTokenSource = argv["figma-oauth-token"]
        ? "cli"
        : process.env.FIGMA_OAUTH_TOKEN
          ? "env"
          : "none";
    const portSource = argv.port ? "cli" : process.env.PORT ? "env" : "default";
    const outputFormatSource = argv.json ? "cli" : process.env.OUTPUT_FORMAT ? "env" : "default";
    const skipImageDownloadsSource = argv["skip-image-downloads"]
        ? "cli"
        : process.env.SKIP_IMAGE_DOWNLOADS
          ? "env"
          : "default";

    if (argv["figma-api-key"]) {
        auth.figmaApiKey = argv["figma-api-key"];
        config.configSources.figmaApiKey = "cli";
    } else if (process.env.FIGMA_API_KEY) {
        auth.figmaApiKey = process.env.FIGMA_API_KEY;
        config.configSources.figmaApiKey = "env";
    }

    if (argv["figma-oauth-token"]) {
        auth.figmaOAuthToken = argv["figma-oauth-token"];
        auth.useOAuth = true;
        config.configSources.figmaOAuthToken = "cli";
    } else if (process.env.FIGMA_OAUTH_TOKEN) {
        auth.figmaOAuthToken = process.env.FIGMA_OAUTH_TOKEN;
        auth.useOAuth = true;
        config.configSources.figmaOAuthToken = "env";
    }

    if (argv.port) {
        config.port = argv.port;
        config.configSources.port = "cli";
    } else if (process.env.PORT) {
        config.port = parseInt(process.env.PORT, 10);
        config.configSources.port = "env";
    }

    if (argv.json) {
        config.outputFormat = "json";
        config.configSources.outputFormat = "cli";
    } else if (process.env.OUTPUT_FORMAT === "json") {
        config.outputFormat = "json";
        config.configSources.outputFormat = "env";
    }

    if (argv["skip-image-downloads"]) {
        config.skipImageDownloads = true;
        config.configSources.skipImageDownloads = "cli";
    } else if (process.env.SKIP_IMAGE_DOWNLOADS === "true") {
        config.skipImageDownloads = true;
        config.configSources.skipImageDownloads = "env";
    }

    if (!isStdioMode && config.port) {
        console.log(`Using port: ${config.port} (source: ${portSource})`);
    }

    if (auth.figmaApiKey || auth.figmaOAuthToken) {
        const maskedKey = auth.figmaApiKey ? maskApiKey(auth.figmaApiKey) : "N/A";
        const maskedToken = auth.figmaOAuthToken ? maskApiKey(auth.figmaOAuthToken) : "N/A";
        console.log(
            `Figma API Key: ${maskedKey} (source: ${figmaApiKeySource}) | OAuth Token: ${maskedToken} (source: ${figmaOAuthTokenSource})`,
        );
    } else {
        console.warn("Warning: No Figma API key or OAuth token provided. Set FIGMA_API_KEY or FIGMA_OAUTH_TOKEN environment variable, or use --figma-api-key or --figma-oauth-token CLI flag.");
    }

    if (config.outputFormat) {
        console.log(`Output format: ${config.outputFormat} (source: ${outputFormatSource})`);
    }

    if (config.skipImageDownloads) {
        console.log(`Skip image downloads: ${config.skipImageDownloads} (source: ${skipImageDownloadsSource})`);
    }

    const enableLogs = process.env.FIGMA_ENABLE_LOGS === "true" || process.env.ENABLE_FIGMA_LOGS === "true";
    if (enableLogs) {
        console.log("Figma logging: ENABLED (logs will be saved to src/logs/)");
    } else {
        console.log("Figma logging: DISABLED (set FIGMA_ENABLE_LOGS=true to enable)");
    }

    return {
        ...config,
        auth,
    };
}

