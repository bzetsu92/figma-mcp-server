import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { BaseExtractor } from "./extractor-base";
import type { ExtractedNode, TraversalContext } from "./types";
import {
    extractNodeText,
    extractTextStyle,
    hasTextStyle,
    isTextNode,
} from "@transformers/text";
import { findOrCreateVar, getStyleName } from "./utils";

export class TextExtractor extends BaseExtractor {
    readonly name = "TextExtractor";

    extract(node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext): void {
        if (isTextNode(node)) {
            result.text = extractNodeText(node);
        }

        if (hasTextStyle(node)) {
            const textStyle = extractTextStyle(node);
            if (textStyle) {
                const styleName = getStyleName(node, context, ["text", "typography"]);
                if (styleName) {
                    context.globalVars.styles[styleName] = textStyle;
                    result.textStyle = styleName;
                } else {
                    result.textStyle = findOrCreateVar(context.globalVars, textStyle, "style");
                }
            }
        }
    }
}

const textExtractorInstance = new TextExtractor();
export const textExtractor: (node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext) => void =
    (node, result, context) => {
        textExtractorInstance.extract(node, result, context);
    };

