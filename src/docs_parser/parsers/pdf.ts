import fs from "fs";
import pdf from "pdf-parse";

export async function parsePDF(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`PDF file not found: ${filePath}`);
    }

    try {
        const buffer = fs.readFileSync(filePath);
        const data = await pdf(buffer);
        return data.text || "";
    } catch (error) {
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
}

