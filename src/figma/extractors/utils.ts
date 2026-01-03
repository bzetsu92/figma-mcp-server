import type { Node as FigmaDocumentNode, Style } from "@figma/rest-api-spec";
import { generateVarId } from "@shared/common";
import { hasValue } from "@shared/identity";
import type { GlobalVars, StyleTypes, TraversalContext } from "./types";

export function findOrCreateVar(globalVars: GlobalVars, value: StyleTypes, prefix: string): string {
    const [existingVarId] =
        Object.entries(globalVars.styles).find(
            ([_, existingValue]) => JSON.stringify(existingValue) === JSON.stringify(value),
        ) ?? [];

    if (existingVarId) {
        return existingVarId;
    }

    const varId = generateVarId(prefix);
    globalVars.styles[varId] = value;
    return varId;
}

export function getStyleName(
    node: FigmaDocumentNode,
    context: TraversalContext,
    keys: string[],
): string | undefined {
    if (!hasValue("styles", node)) return undefined;
    const styleMap = node.styles as Record<string, string>;
    for (const key of keys) {
        const styleId = styleMap[key];
        if (styleId) {
            const meta = context.globalVars.extraStyles?.[styleId];
            if (meta?.name) return meta.name;
        }
    }
    return undefined;
}

