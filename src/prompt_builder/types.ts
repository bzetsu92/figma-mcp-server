export interface FigmaScreenData {
    screen: string;
    components: string[];
    fields: Array<{ name: string; type: string }>;
    actions: string[];
}

export interface DocsData {
    rules: string[];
    flows: string[];
    facts?: Array<{
        text: string;
        category: string;
        confidence: number;
        source?: string;
    }>;
    roles?: string[];
}

