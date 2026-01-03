import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { isVisible } from "@shared/common";
import { hasValue } from "@shared/identity";
import type {
    ExtractedNode,
    TraversalContext,
    TraversalOptions,
    GlobalVars,
} from "./types";
import { BaseExtractor as BaseExtractorClass, type ExtractorFn } from "./extractor-base";
import type { BaseExtractor } from "./extractor-base";

export function extractFromDesign(
    nodes: FigmaDocumentNode[],
    extractors: (BaseExtractor | ExtractorFn)[],
    options: TraversalOptions = {},
    globalVars: GlobalVars = { styles: {} },
): { nodes: ExtractedNode[]; globalVars: GlobalVars } {
    const context: TraversalContext = {
        globalVars,
        currentDepth: 0,
    };

    const processedNodes = nodes
        .filter((node) => shouldProcessNode(node, options))
        .map((node) => processNodeWithExtractors(node, extractors, context, options))
        .filter((node): node is ExtractedNode => node !== null);

    return {
        nodes: processedNodes,
        globalVars: context.globalVars,
    };
}

function processNodeWithExtractors(
    node: FigmaDocumentNode,
    extractors: (BaseExtractor | ExtractorFn)[],
    context: TraversalContext,
    options: TraversalOptions,
): ExtractedNode | null {
    if (!shouldProcessNode(node, options)) {
        return null;
    }

    const result: ExtractedNode = {
        id: node.id,
        name: node.name,
        type: node.type === "VECTOR" ? "IMAGE-SVG" : node.type,
    };

    for (const extractor of extractors) {
        if (extractor instanceof BaseExtractorClass) {
            if (extractor.shouldExtract(node)) {
                extractor.extract(node, result, context);
            }
        } else {
            extractor(node, result, context);
        }
    }

    if (shouldTraverseChildren(node, context, options)) {
        const childContext: TraversalContext = {
            ...context,
            currentDepth: context.currentDepth + 1,
            parent: node,
        };

        if (hasValue("children", node) && node.children.length > 0) {
            const children = node.children
                .filter((child) => shouldProcessNode(child, options))
                .map((child) => processNodeWithExtractors(child, extractors, childContext, options))
                .filter((child): child is ExtractedNode => child !== null);

            if (children.length > 0) {
                const childrenToInclude = options.afterChildren
                    ? options.afterChildren(node, result, children)
                    : children;

                if (childrenToInclude.length > 0) {
                    result.children = childrenToInclude;
                }
            }
        }
    }

    return result;
}

function shouldProcessNode(node: FigmaDocumentNode, options: TraversalOptions): boolean {
    if (!isVisible(node)) {
        return false;
    }

    if (options.nodeFilter && !options.nodeFilter(node)) {
        return false;
    }

    return true;
}

function shouldTraverseChildren(
    node: FigmaDocumentNode,
    context: TraversalContext,
    options: TraversalOptions,
): boolean {
    if (options.maxDepth !== undefined && context.currentDepth >= options.maxDepth) {
        return false;
    }

    return true;
}

