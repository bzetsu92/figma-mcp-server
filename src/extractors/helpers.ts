import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import type { ExtractedNode } from "./types";

export const SVG_ELIGIBLE_TYPES = new Set([
    "IMAGE-SVG",
    "STAR",
    "LINE",
    "ELLIPSE",
    "REGULAR_POLYGON",
    "RECTANGLE",
]);

export function collapseSvgContainers(
    node: FigmaDocumentNode,
    result: ExtractedNode,
    children: ExtractedNode[],
): ExtractedNode[] {
    const allChildrenAreSvgEligible = children.every((child) => SVG_ELIGIBLE_TYPES.has(child.type));

    if (
        (node.type === "FRAME" || node.type === "GROUP" || node.type === "INSTANCE") &&
        allChildrenAreSvgEligible
    ) {
        result.type = "IMAGE-SVG";
        return [];
    }

    return children;
}

