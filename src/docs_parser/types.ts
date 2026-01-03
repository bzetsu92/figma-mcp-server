export type SourceType = "pdf" | "docx" | "xlsx" | "txt" | "md";

export type Role = "user" | "admin" | "system" | "guest" | "manager" | "developer" | "unknown";

export interface Fact {
    text: string;
    category: "rule" | "requirement" | "constraint" | "validation" | "business" | "technical";
    confidence: number;
    source?: string;
}

export interface Section {
    heading?: string;
    content: string;
    meta?: Record<string, unknown>;
    roles?: Role[];
    facts?: Fact[];
}

export interface DocumentJSON {
    id: string;
    source: SourceType;
    sections: Section[];
    summary?: string;
    facts?: Fact[];
    roles?: Role[];
    promptReady?: string;
}

export interface ScreenContext {
    screen: string;
    components?: string[];
    fields?: Array<{ name: string; type: string }>;
    actions?: string[];
}

export interface ParsedDocsData {
    rules: string[];
    flows: string[];
    facts?: Fact[];
    roles?: Role[];
}

