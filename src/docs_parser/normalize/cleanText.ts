export function cleanText(text: string): string {
    return text
        .replace(/\n{2,}/g, "\n\n")
        .replace(/[ \t]+/g, " ")
        .replace(/Page \d+/gi, "")
        .trim();
}

