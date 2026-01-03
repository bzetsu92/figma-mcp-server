import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { BaseExtractor } from "./extractor-base";
import type { ExtractedNode, TraversalContext } from "./types";
import { buildSimplifiedLayout } from "@transformers/layout";
import { findOrCreateVar } from "./utils";

export class LayoutExtractor extends BaseExtractor {
    readonly name = "LayoutExtractor";

    extract(node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext): void {
        const layout = buildSimplifiedLayout(node, context.parent);
        if (Object.keys(layout).length > 1) {
            result.layout = findOrCreateVar(context.globalVars, layout, "layout");
        }
    }
}

const layoutExtractorInstance = new LayoutExtractor();
export const layoutExtractor: (node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext) => void =
    (node, result, context) => {
        layoutExtractorInstance.extract(node, result, context);
    };

