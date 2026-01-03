import path from "path";
import fs from "fs";
import { parsePDF } from "./parsers/pdf";
import { parseDOCX } from "./parsers/docx";
import { parseXLSX } from "./parsers/xlsx";
import { cleanText } from "./normalize/cleanText";
import { semanticChunk } from "./normalize/semanticChunker";
import { summarize } from "./normalize/summarizer";
import { extractFacts } from "./normalize/factsExtractor";
import { tagRoles } from "./normalize/roleTagger";
import { formatForCursor } from "./normalize/promptFormatter";
import { DocumentJSON, SourceType } from "./types";

export async function runPipeline(file: string, options?: { includePromptReady?: boolean }): Promise<DocumentJSON> {
    if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
    }

    const ext = path.extname(file).toLowerCase();
    let raw = "";

    if (ext === ".pdf") {
        raw = await parsePDF(file);
    } else if (ext === ".docx" || ext === ".doc") {
        raw = await parseDOCX(file);
    } else if (ext === ".xlsx" || ext === ".xls") {
        raw = parseXLSX(file);
    } else if (ext === ".txt" || ext === ".md") {
        raw = fs.readFileSync(file, "utf-8");
    } else {
        throw new Error(`Unsupported file type: ${ext}. Supported: .pdf, .docx, .doc, .xlsx, .xls, .txt, .md`);
    }

    if (!raw || raw.trim().length === 0) {
        throw new Error(`File appears to be empty: ${file}`);
    }

    // Step 1: Clean and chunk
    const cleaned = cleanText(raw);
    let sections = semanticChunk(cleaned);

    // Step 2: Extract facts
    const facts = extractFacts(sections);

    // Step 3: Tag roles
    const { sections: taggedSections, roles } = tagRoles(sections);
    sections = taggedSections;

    // Step 4: Summarize
    const summary = summarize(sections);

    // Step 5: Format for Cursor (if requested)
    const sourceType = ext.slice(1) as SourceType;
    const document: DocumentJSON = {
        id: path.basename(file),
        source: sourceType,
        sections,
        summary,
        facts,
        roles,
    };

    if (options?.includePromptReady !== false) {
        document.promptReady = formatForCursor(document);
    }

    return document;
}

