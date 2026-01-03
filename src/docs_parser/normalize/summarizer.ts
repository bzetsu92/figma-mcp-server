import { Section } from "../types";

const IMPORTANT_KEYWORDS = /thời hạn|hiệu lực|trách nhiệm|thanh toán|ngày|năm|deadline|valid|responsibility|payment|date|year|required|must|should|validation|rule/i;

export function summarize(sections: Section[]): string {
    if (sections.length === 0) {
        return "";
    }

    const important = sections
        .flatMap((s) => s.content.split(/[.!?]+/))
        .map((s) => s.trim())
        .filter((s) => s.length > 10 && IMPORTANT_KEYWORDS.test(s))
        .slice(0, 5);

    if (important.length === 0) {
        return "";
    }

    return important.join(". ") + ".";
}

