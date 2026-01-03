import { DocumentJSON, Fact, Role } from "../types";

export function formatForCursor(document: DocumentJSON): string {
    const parts: string[] = [];

    parts.push(`# Document: ${document.id}`);
    parts.push(`Source: ${document.source.toUpperCase()}`);
    parts.push("");

    if (document.summary) {
        parts.push("## Summary");
        parts.push(document.summary);
        parts.push("");
    }

    if (document.facts && document.facts.length > 0) {
        parts.push("## Key Facts");
        const factsByCategory = new Map<string, Fact[]>();
        
        for (const fact of document.facts.slice(0, 20)) {
            const category = fact.category;
            if (!factsByCategory.has(category)) {
                factsByCategory.set(category, []);
            }
            factsByCategory.get(category)!.push(fact);
        }

        for (const [category, facts] of factsByCategory.entries()) {
            parts.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)}`);
            for (const fact of facts.slice(0, 5)) {
                parts.push(`- ${fact.text}`);
            }
            parts.push("");
        }
    }

    // Roles
    if (document.roles && document.roles.length > 0) {
        parts.push("## Relevant Roles");
        parts.push(document.roles.filter((r) => r !== "unknown").join(", "));
        parts.push("");
    }

    if (document.sections.length <= 10) {
        parts.push("## Sections");
        for (const section of document.sections) {
            if (section.heading) {
                parts.push(`### ${section.heading}`);
            }
            const preview = section.content.substring(0, 200);
            parts.push(preview + (section.content.length > 200 ? "..." : ""));
            parts.push("");
        }
    } else {
        parts.push(`## Sections (${document.sections.length} total)`);
        parts.push("Document has many sections. Key sections:");
        for (const section of document.sections.slice(0, 5)) {
            if (section.heading) {
                parts.push(`- **${section.heading}**`);
            }
        }
        parts.push("");
    }

    return parts.join("\n");
}

