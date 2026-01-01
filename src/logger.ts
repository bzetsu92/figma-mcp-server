import fs from "fs";

export const Logger = {
    isHTTP: false,
    log: (...args: unknown[]) => {
        if (Logger.isHTTP) {
            console.log("[INFO]", ...args);
        } else {
            console.error("[INFO]", ...args);
        }
    },
    error: (...args: unknown[]) => {
        console.error("[ERROR]", ...args);
    },
};

let logsDirInitialized = false;
const logsDir = "logs";

function ensureLogsDir(): void {
    if (logsDirInitialized) return;

    try {
        fs.accessSync(process.cwd(), fs.constants.W_OK);

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        logsDirInitialized = true;
    } catch {
        logsDirInitialized = true;
    }
}

export function writeLogs(name: string, value: unknown): void {
    const enableLogs = process.env.FIGMA_ENABLE_LOGS === "true" || process.env.ENABLE_FIGMA_LOGS === "true";
    if (!enableLogs) return;

    try {
        ensureLogsDir();
        const logPath = `${logsDir}/${name}`;
        fs.writeFileSync(logPath, JSON.stringify(value, null, 2));
        Logger.log(`Debug log written to: ${logPath}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        Logger.log(`Failed to write logs to ${name}: ${errorMessage}`);
    }
}

