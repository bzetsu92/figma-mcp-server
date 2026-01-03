import type { ScreenContext, ParsedDocsData, Fact } from "./types";

export async function extractRulesAndFlows(
    documentText: string,
    facts: Fact[],
    screenContext?: ScreenContext,
): Promise<ParsedDocsData> {
    const rules: string[] = [];
    const flows: string[] = [];

    const lines = documentText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

    const searchKeywords: string[] = [];
    if (screenContext) {
        const screenNameLower = screenContext.screen.toLowerCase();
        searchKeywords.push(screenNameLower);
        searchKeywords.push(...screenNameLower.split(/\s+/));

        if (screenContext.fields) {
            screenContext.fields.forEach((field) => {
                searchKeywords.push(field.name.toLowerCase());
            });
        }

        if (screenContext.components) {
            screenContext.components.forEach((comp) => {
                const compLower = comp.toLowerCase();
                searchKeywords.push(compLower);
                searchKeywords.push(...compLower.replace(/([A-Z])/g, " $1").toLowerCase().split(/\s+/));
            });
        }

        if (screenContext.actions) {
            screenContext.actions.forEach((action) => {
                searchKeywords.push(action.toLowerCase());
            });
        }
    }

    const isRelevantToScreen = (line: string): boolean => {
        if (!screenContext || searchKeywords.length === 0) {
            return true;
        }

        const lowerLine = line.toLowerCase();
        return searchKeywords.some((keyword) => lowerLine.includes(keyword));
    };

    const rulePatterns = [
        /(?:must|should|required|need|validate|check|ensure|rule|quy định|yêu cầu|cần phải)/i,
        /(?:minimum|maximum|min|max|at least|at most|between|from \d+ to \d+)/i,
        /(?:format|pattern|regex|regexp)/i,
        /(?:cannot|must not|should not|không được|không thể)/i,
    ];

    const flowPatterns = [
        /(?:user|người dùng|khách hàng).*(?:enters|enters|clicks|submits|navigates|goes to|chuyển đến|nhập|click|gửi)/i,
        /(?:system|hệ thống).*(?:validates|checks|processes|process|validates|kiểm tra|xử lý)/i,
        /(?:then|sau đó|tiếp theo|next|after that)/i,
        /(?:flow|luồng|quy trình|process|workflow)/i,
    ];

    for (const line of lines) {
        if (!isRelevantToScreen(line)) {
            continue;
        }

        const isRule = rulePatterns.some((pattern) => pattern.test(line)) ||
            /^\d+\.\s*(?:rule|requirement|constraint|validation)/i.test(line) ||
            /^[-*]\s*(?:rule|requirement|constraint|validation)/i.test(line);

        if (isRule && line.length > 10) {
            rules.push(line);
        }

        const isFlow = flowPatterns.some((pattern) => pattern.test(line)) ||
            /(?:step \d+|bước \d+)/i.test(line) ||
            /(?:first|second|third|đầu tiên|thứ hai|thứ ba)/i.test(line);

        if (isFlow && line.length > 10) {
            flows.push(line);
        }
    }

    const uniqueRules = Array.from(new Set(rules));
    const uniqueFlows = Array.from(new Set(flows));

    let relevantFacts = facts;
    if (screenContext && searchKeywords.length > 0) {
        relevantFacts = facts.filter((fact) => {
            const factTextLower = fact.text.toLowerCase();
            return searchKeywords.some((keyword) => factTextLower.includes(keyword));
        });
    }

    return {
        rules: uniqueRules,
        flows: uniqueFlows,
        facts: relevantFacts.length > 0 ? relevantFacts : undefined,
        roles: undefined,
    };
}

