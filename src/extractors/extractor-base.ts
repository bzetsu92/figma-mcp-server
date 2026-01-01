import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import type { ExtractedNode, TraversalContext } from "./types";

export abstract class BaseExtractor {
    abstract readonly name: string;

    abstract extract(
        node: FigmaDocumentNode,
        result: ExtractedNode,
        context: TraversalContext,
    ): void;

    shouldExtract(node: FigmaDocumentNode): boolean {
        return true;
    }
}

export type ExtractorFn = (
    node: FigmaDocumentNode,
    result: ExtractedNode,
    context: TraversalContext,
) => void;

export function toExtractorClass(fn: ExtractorFn, name: string): BaseExtractor {
    return new (class extends BaseExtractor {
        readonly name = name;
        extract(node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext): void {
            fn(node, result, context);
        }
    })();
}

