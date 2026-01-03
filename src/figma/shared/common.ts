import fs from "fs";
import path from "path";

export type StyleId = `${string}_${string}` & { __brand: "StyleId" };

export async function downloadFigmaImage(
    fileName: string,
    localPath: string,
    imageUrl: string,
): Promise<string> {
    try {
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }

        const fullPath = path.join(localPath, fileName);

        const response = await fetch(imageUrl, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }

        const writer = fs.createWriteStream(fullPath);
        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("Failed to get response body");
        }

        return new Promise((resolve, reject) => {
            const processStream = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            writer.end();
                            break;
                        }
                        if (value) {
                            writer.write(value);
                        }
                    }
                } catch (err) {
                    writer.end();
                    fs.unlink(fullPath, () => {
                        // Ignore unlink errors
                    });
                    reject(err);
                }
            };

            writer.on("finish", () => {
                resolve(fullPath);
            });

            writer.on("error", (err) => {
                reader.cancel();
                fs.unlink(fullPath, () => {});
                reject(new Error(`Failed to write image: ${err.message}`));
            });

            processStream();
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Error downloading image: ${errorMessage}`);
    }
}

export function removeEmptyKeys<T>(input: T): T {
    if (typeof input !== "object" || input === null) {
        return input;
    }

    if (Array.isArray(input)) {
        return input.map((item) => removeEmptyKeys(item)) as T;
    }

    const result = {} as T;
    for (const key in input) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            const value = input[key];
            const cleanedValue = removeEmptyKeys(value);

            if (
                cleanedValue !== undefined &&
                !(Array.isArray(cleanedValue) && cleanedValue.length === 0) &&
                !(
                    typeof cleanedValue === "object" &&
                    cleanedValue !== null &&
                    Object.keys(cleanedValue).length === 0
                )
            ) {
                result[key] = cleanedValue;
            }
        }
    }

    return result;
}

export function generateVarId(prefix: string = "var"): StyleId {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";

    for (let i = 0; i < 6; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        result += chars[randomIndex];
    }

    return `${prefix}_${result}` as StyleId;
}

export function generateCSSShorthand(
    values: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    },
    {
        ignoreZero = true,
        suffix = "px",
    }: {
        ignoreZero?: boolean;
        suffix?: string;
    } = {},
) {
    const { top, right, bottom, left } = values;
    if (ignoreZero && top === 0 && right === 0 && bottom === 0 && left === 0) {
        return undefined;
    }
    if (top === right && right === bottom && bottom === left) {
        return `${top}${suffix}`;
    }
    if (right === left) {
        if (top === bottom) {
            return `${top}${suffix} ${right}${suffix}`;
        }
        return `${top}${suffix} ${right}${suffix} ${bottom}${suffix}`;
    }
    return `${top}${suffix} ${right}${suffix} ${bottom}${suffix} ${left}${suffix}`;
}

export function isVisible(element: { visible?: boolean }): boolean {
    return element.visible ?? true;
}

export function pixelRound(num: number): number {
    if (isNaN(num)) {
        throw new TypeError(`Input must be a valid number`);
    }
    return Number(Number(num).toFixed(2));
}

