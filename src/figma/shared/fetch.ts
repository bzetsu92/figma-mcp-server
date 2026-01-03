import { execFile } from "child_process";
import { promisify } from "util";
import { Logger } from "~/logger";

const execFileAsync = promisify(execFile);

type RequestOptions = RequestInit & {
    headers?: Record<string, string>;
};

export async function fetchWithRetry<T = any>(
    url: string,
    options: RequestOptions = {},
): Promise<T> {
    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`Fetch failed with status ${response.status}: ${response.statusText}`);
        }
        return (await response.json()) as T;
    } catch (fetchError: unknown) {
        const errorMessage =
            fetchError instanceof Error ? fetchError.message : String(fetchError);
        Logger.log(
            `[fetchWithRetry] Initial fetch failed for ${url}: ${errorMessage}. Likely a corporate proxy or SSL issue. Attempting curl fallback.`,
        );

        const curlHeaders = formatHeadersForCurl(options.headers);
        const curlArgs = ["-s", "-S", "--fail-with-body", "-L", ...curlHeaders, url];

        try {
            Logger.log(`[fetchWithRetry] Executing curl with args: ${JSON.stringify(curlArgs)}`);
            const { stdout, stderr } = await execFileAsync("curl", curlArgs);

            if (stderr) {
                const stderrLower = stderr.toLowerCase();
                if (
                    !stdout ||
                    stderrLower.includes("error") ||
                    stderrLower.includes("fail")
                ) {
                    throw new Error(`Curl command failed with stderr: ${stderr}`);
                }
                Logger.log(
                    `[fetchWithRetry] Curl command for ${url} produced stderr (but might be informational): ${stderr}`,
                );
            }

            if (!stdout) {
                throw new Error("Curl command returned empty stdout.");
            }

            const result = JSON.parse(stdout) as T;

            if (
                typeof result === "object" &&
                result !== null &&
                "status" in result &&
                typeof (result as { status?: number }).status === "number" &&
                (result as { status: number }).status !== 200
            ) {
                throw new Error(`Curl command failed: ${JSON.stringify(result)}`);
            }

            return result;
        } catch (curlError: unknown) {
            const curlErrorMessage =
                curlError instanceof Error ? curlError.message : String(curlError);
            Logger.error(
                `[fetchWithRetry] Curl fallback also failed for ${url}: ${curlErrorMessage}`,
            );
            throw fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        }
    }
}

function formatHeadersForCurl(headers: Record<string, string> | undefined): string[] {
    if (!headers) {
        return [];
    }

    const headerArgs: string[] = [];
    for (const [key, value] of Object.entries(headers)) {
        headerArgs.push("-H", `${key}: ${value}`);
    }
    return headerArgs;
}

