import { Fact, Section } from "../types";

const FACT_PATTERNS = {
    rule: /(?:must|should|shall|required|mandatory|obligatory|phải|bắt buộc)/i,
    requirement: /(?:requirement|need|yêu cầu|cần)/i,
    constraint: /(?:constraint|limit|restriction|giới hạn|ràng buộc)/i,
    validation: /(?:validate|validation|verify|check|kiểm tra|xác thực)/i,
    business: /(?:business|policy|procedure|quy trình|chính sách)/i,
    technical: /(?:technical|api|endpoint|database|db|kỹ thuật)/i,
};

const FACT_INDICATORS = [
    /^\d+\.\s+/,
    /^[-*]\s+/,
    /^[A-Z][^.!?]*[.!?]$/,
];

export function extractFacts(sections: Section[]): Fact[] {
    const facts: Fact[] = [];

    for (const section of sections) {
        const content = section.content;
        const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 20);

        for (const sentence of sentences) {
            let category: Fact["category"] | null = null;
            let confidence = 0.5;

            for (const [cat, pattern] of Object.entries(FACT_PATTERNS)) {
                if (pattern.test(sentence)) {
                    category = cat as Fact["category"];
                    confidence = 0.8;
                    break;
                }
            }

            const isFactLike = FACT_INDICATORS.some((pattern) => pattern.test(sentence)) ||
                /(?:is|are|has|have|must|should|will|can|cannot)/i.test(sentence);

            if (isFactLike && category) {
                facts.push({
                    text: sentence,
                    category,
                    confidence,
                    source: section.heading || undefined,
                });
            }
        }
    }

    const uniqueFacts = Array.from(
        new Map(facts.map((f) => [f.text.toLowerCase(), f])).values()
    ).sort((a, b) => b.confidence - a.confidence);

    return uniqueFacts.slice(0, 50);
}

