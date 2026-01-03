import fs from "fs";
import mammoth from "mammoth";

export async function parseDOCX(filePath: string): Promise<string> {
    if (!fs.existsSync(filePath)) {
        throw new Error(`DOCX file not found: ${filePath}`);
    }

    try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        
        if (result.messages.length > 0) {
            console.warn(`DOCX parsing warnings for ${filePath}:`, result.messages);
        }
        
        return result.value || "";
    } catch (error) {
        throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : String(error)}`);
    }
}

