import type { Node as FigmaDocumentNode, Style } from "@figma/rest-api-spec";
import type { SimplifiedTextStyle } from "@transformers/text";
import type { SimplifiedLayout } from "@transformers/layout";
import type { SimplifiedFill, SimplifiedStroke } from "@transformers/style";
import type { SimplifiedEffects } from "@transformers/effects";
import type {
    ComponentProperties,
    SimplifiedComponentDefinition,
    SimplifiedComponentSetDefinition,
} from "@transformers/component";

export type StyleTypes =
    | SimplifiedTextStyle
    | SimplifiedFill[]
    | SimplifiedLayout
    | SimplifiedStroke
    | SimplifiedEffects
    | string;

export type GlobalVars = {
    styles: Record<string, StyleTypes>;
};

export interface TraversalContext {
    globalVars: GlobalVars & { extraStyles?: Record<string, Style> };
    currentDepth: number;
    parent?: FigmaDocumentNode;
}

export interface TraversalOptions {
    maxDepth?: number;
    nodeFilter?: (node: FigmaDocumentNode) => boolean;
    afterChildren?: (
        node: FigmaDocumentNode,
        result: ExtractedNode,
        children: ExtractedNode[],
    ) => ExtractedNode[];
}

export interface ExtractedNode {
    id: string;
    name: string;
    type: string;
    text?: string;
    textStyle?: string;
    fills?: string;
    styles?: string;
    strokes?: string;
    strokeWeight?: string;
    strokeDashes?: number[];
    strokeWeights?: string;
    effects?: string;
    opacity?: number;
    borderRadius?: string;
    layout?: string;
    componentId?: string;
    componentProperties?: ComponentProperties[];
    inputType?: string;
    placeholder?: string;
    inputValue?: string;
    isInput?: boolean;
    blendMode?: string;
    locked?: boolean;
    visible?: boolean;
    rotation?: number;
    exportSettings?: Array<{
        format: string;
        suffix: string;
        constraint?: {
            type: string;
            value: number;
        };
    }>;
    constraints?: {
        horizontal: string;
        vertical: string;
    };
    children?: ExtractedNode[];
}

export interface ExtractedDesign {
    name: string;
    nodes: ExtractedNode[];
    components: Record<string, SimplifiedComponentDefinition>;
    componentSets: Record<string, SimplifiedComponentSetDefinition>;
    globalVars: GlobalVars;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

