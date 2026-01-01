import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { BaseExtractor } from "./extractor-base";
import type { ExtractedNode, TraversalContext } from "./types";
import { buildSimplifiedStrokes, parsePaint } from "@transformers/style";
import { buildSimplifiedEffects } from "@transformers/effects";
import { hasValue, isRectangleCornerRadii } from "@shared/identity";
import { findOrCreateVar, getStyleName } from "./utils";

export class VisualsExtractor extends BaseExtractor {
    readonly name = "VisualsExtractor";

    extract(node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext): void {
        const hasChildren =
            hasValue("children", node) && Array.isArray(node.children) && node.children.length > 0;

        if (hasValue("fills", node) && Array.isArray(node.fills) && node.fills.length) {
            const fills = node.fills.map((fill) => parsePaint(fill, hasChildren)).reverse();
            const styleName = getStyleName(node, context, ["fill", "fills"]);
            if (styleName) {
                context.globalVars.styles[styleName] = fills;
                result.fills = styleName;
            } else {
                result.fills = findOrCreateVar(context.globalVars, fills, "fill");
            }
        }

        const strokes = buildSimplifiedStrokes(node, hasChildren);
        if (strokes.colors.length) {
            const styleName = getStyleName(node, context, ["stroke", "strokes"]);
            if (styleName) {
                context.globalVars.styles[styleName] = strokes.colors;
                result.strokes = styleName;
                if (strokes.strokeWeight) result.strokeWeight = strokes.strokeWeight;
                if (strokes.strokeDashes) result.strokeDashes = strokes.strokeDashes;
                if (strokes.strokeWeights) result.strokeWeights = strokes.strokeWeights;
            } else {
                result.strokes = findOrCreateVar(context.globalVars, strokes, "stroke");
            }
        }

        const effects = buildSimplifiedEffects(node);
        if (Object.keys(effects).length) {
            const styleName = getStyleName(node, context, ["effect", "effects"]);
            if (styleName) {
                context.globalVars.styles[styleName] = effects;
                result.effects = styleName;
            } else {
                result.effects = findOrCreateVar(context.globalVars, effects, "effect");
            }
        }

        if (hasValue("opacity", node) && typeof node.opacity === "number" && node.opacity !== 1) {
            result.opacity = node.opacity;
        }

        if (hasValue("cornerRadius", node) && typeof node.cornerRadius === "number") {
            result.borderRadius = `${node.cornerRadius}px`;
        }
        if (hasValue("rectangleCornerRadii", node, isRectangleCornerRadii)) {
            result.borderRadius = `${node.rectangleCornerRadii[0]}px ${node.rectangleCornerRadii[1]}px ${node.rectangleCornerRadii[2]}px ${node.rectangleCornerRadii[3]}px`;
        }
    }
}

const visualsExtractorInstance = new VisualsExtractor();
export const visualsExtractor: (node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext) => void =
    (node, result, context) => {
        visualsExtractorInstance.extract(node, result, context);
    };

