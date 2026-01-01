import type { Node as FigmaDocumentNode, ComponentPropertyType } from "@figma/rest-api-spec";
import { BaseExtractor } from "./extractor-base";
import type { ExtractedNode, TraversalContext } from "./types";
import { hasValue } from "@shared/identity";

export class ComponentExtractor extends BaseExtractor {
    readonly name = "ComponentExtractor";

    shouldExtract(node: FigmaDocumentNode): boolean {
        return node.type === "INSTANCE";
    }

    extract(node: FigmaDocumentNode, result: ExtractedNode, _context: TraversalContext): void {
        if (hasValue("componentId", node)) {
            result.componentId = node.componentId;
        }

        if (hasValue("componentProperties", node)) {
            result.componentProperties = Object.entries(node.componentProperties ?? {}).map(
                ([name, { value, type }]) => ({
                    name,
                    value: value.toString(),
                    type: type as ComponentPropertyType,
                }),
            );
        }
    }
}

const componentExtractorInstance = new ComponentExtractor();
export const componentExtractor: (node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext) => void =
    (node, result, context) => {
        componentExtractorInstance.extract(node, result, context);
    };
