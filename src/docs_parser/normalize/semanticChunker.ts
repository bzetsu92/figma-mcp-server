import { Section } from "../types";

const HEADING_REGEX = /^(Điều|Chương|Chapter|Section|\d+[\.\)])\s+/i;

export function semanticChunk(text: string): Section[] {
    if (!text || text.trim().length === 0) {
        return [];
    }

    const lines = text.split("\n");
    const sections: Section[] = [];

    let current: Section = { content: "" };

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (HEADING_REGEX.test(trimmedLine)) {
            if (current.content.trim()) {
                sections.push(current);
            }
            current = {
                heading: trimmedLine,
                content: "",
            };
        } else {
            current.content += line + " ";
        }
    }

    if (current.content.trim()) {
        sections.push(current);
    }

    return sections.map((s) => ({
        ...s,
        content: s.content.trim(),
    }));
}

