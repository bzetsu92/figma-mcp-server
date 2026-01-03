import { isInAutoLayoutFlow, isFrame, isLayout, isRectangle } from "@shared/identity";
import type {
    Node as FigmaDocumentNode,
    HasFramePropertiesTrait,
    HasLayoutTrait,
} from "@figma/rest-api-spec";
import { generateCSSShorthand, pixelRound } from "@shared/common";

export interface SimplifiedLayout {
    mode: "none" | "row" | "column";
    justifyContent?:
        | "flex-start"
        | "flex-end"
        | "center"
        | "space-between"
        | "baseline"
        | "stretch";
    alignItems?: "flex-start" | "flex-end" | "center" | "space-between" | "baseline" | "stretch";
    alignSelf?: "flex-start" | "flex-end" | "center" | "stretch";
    wrap?: boolean;
    gap?: string;
    locationRelativeToParent?: {
        x: number;
        y: number;
    };
    dimensions?: {
        width?: number;
        height?: number;
        aspectRatio?: number;
    };
    padding?: string;
    sizing?: {
        horizontal?: "fixed" | "fill" | "hug";
        vertical?: "fixed" | "fill" | "hug";
    };
    overflowScroll?: ("x" | "y")[];
    position?: "absolute";
}

export function buildSimplifiedLayout(
    n: FigmaDocumentNode,
    parent?: FigmaDocumentNode,
): SimplifiedLayout {
    const frameValues = buildSimplifiedFrameValues(n);
    const layoutValues = buildSimplifiedLayoutValues(n, parent, frameValues.mode) || {};

    return { ...frameValues, ...layoutValues };
}

function convertAlign(
    axisAlign?:
        | HasFramePropertiesTrait["primaryAxisAlignItems"]
        | HasFramePropertiesTrait["counterAxisAlignItems"],
    stretch?: {
        children: FigmaDocumentNode[];
        axis: "primary" | "counter";
        mode: "row" | "column" | "none";
    },
) {
    if (stretch && stretch.mode !== "none") {
        const { children, mode, axis } = stretch;

        const direction = getDirection(axis, mode);

        const shouldStretch =
            children.length > 0 &&
            children.reduce((shouldStretch, c) => {
                if (!shouldStretch) return false;
                if ("layoutPositioning" in c && c.layoutPositioning === "ABSOLUTE") return true;
                if (direction === "horizontal") {
                    return "layoutSizingHorizontal" in c && c.layoutSizingHorizontal === "FILL";
                } else if (direction === "vertical") {
                    return "layoutSizingVertical" in c && c.layoutSizingVertical === "FILL";
                }
                return false;
            }, true);

        if (shouldStretch) return "stretch";
    }

    switch (axisAlign) {
        case "MIN":
            return undefined;
        case "MAX":
            return "flex-end";
        case "CENTER":
            return "center";
        case "SPACE_BETWEEN":
            return "space-between";
        case "BASELINE":
            return "baseline";
        default:
            return undefined;
    }
}

function convertSelfAlign(align?: HasLayoutTrait["layoutAlign"]) {
    switch (align) {
        case "MIN":
            return undefined;
        case "MAX":
            return "flex-end";
        case "CENTER":
            return "center";
        case "STRETCH":
            return "stretch";
        default:
            return undefined;
    }
}

function convertSizing(
    s?: HasLayoutTrait["layoutSizingHorizontal"] | HasLayoutTrait["layoutSizingVertical"],
) {
    if (s === "FIXED") return "fixed";
    if (s === "FILL") return "fill";
    if (s === "HUG") return "hug";
    return undefined;
}

function getDirection(
    axis: "primary" | "counter",
    mode: "row" | "column",
): "horizontal" | "vertical" {
    if (axis === "primary") {
        return mode === "row" ? "horizontal" : "vertical";
    }
    return mode === "row" ? "horizontal" : "vertical";
}

function buildSimplifiedFrameValues(n: FigmaDocumentNode): SimplifiedLayout | { mode: "none" } {
    if (!isFrame(n)) {
        return { mode: "none" };
    }

    const frameValues: SimplifiedLayout = {
        mode:
            !n.layoutMode || n.layoutMode === "NONE"
                ? "none"
                : n.layoutMode === "HORIZONTAL"
                  ? "row"
                  : "column",
    };

    const overflowScroll: SimplifiedLayout["overflowScroll"] = [];
    if (n.overflowDirection?.includes("HORIZONTAL")) overflowScroll.push("x");
    if (n.overflowDirection?.includes("VERTICAL")) overflowScroll.push("y");
    if (overflowScroll.length > 0) frameValues.overflowScroll = overflowScroll;

    if (frameValues.mode === "none") {
        return frameValues;
    }

    frameValues.justifyContent = convertAlign(n.primaryAxisAlignItems ?? "MIN", {
        children: n.children,
        axis: "primary",
        mode: frameValues.mode,
    });
    frameValues.alignItems = convertAlign(n.counterAxisAlignItems ?? "MIN", {
        children: n.children,
        axis: "counter",
        mode: frameValues.mode,
    });
    frameValues.alignSelf = convertSelfAlign(n.layoutAlign);

    if (n.layoutWrap === "WRAP") {
        frameValues.wrap = true;
    }
    if (n.itemSpacing) {
        frameValues.gap = `${n.itemSpacing}px`;
    }
    if (n.paddingTop || n.paddingBottom || n.paddingLeft || n.paddingRight) {
        frameValues.padding = generateCSSShorthand({
            top: n.paddingTop ?? 0,
            right: n.paddingRight ?? 0,
            bottom: n.paddingBottom ?? 0,
            left: n.paddingLeft ?? 0,
        });
    }

    return frameValues;
}

function buildSimplifiedLayoutValues(
    n: FigmaDocumentNode,
    parent: FigmaDocumentNode | undefined,
    mode: "row" | "column" | "none",
): SimplifiedLayout | undefined {
    if (!isLayout(n)) return undefined;

    const layoutValues: SimplifiedLayout = { mode };

    layoutValues.sizing = {
        horizontal: convertSizing(n.layoutSizingHorizontal),
        vertical: convertSizing(n.layoutSizingVertical),
    };

    // Only include positioning-related properties if parent layout isn't flex or if the node is absolute
    if (
        // If parent is a frame but not an AutoLayout, or if the node is absolute, include positioning-related properties
        isFrame(parent) &&
        !isInAutoLayoutFlow(n, parent)
    ) {
        if (n.layoutPositioning === "ABSOLUTE") {
            layoutValues.position = "absolute";
        }
        if (n.absoluteBoundingBox && parent.absoluteBoundingBox) {
            layoutValues.locationRelativeToParent = {
                x: pixelRound(n.absoluteBoundingBox.x - parent.absoluteBoundingBox.x),
                y: pixelRound(n.absoluteBoundingBox.y - parent.absoluteBoundingBox.y),
            };
        }
    }

    if (isRectangle("absoluteBoundingBox", n)) {
        const dimensions: { width?: number; height?: number; aspectRatio?: number } = {};

        if (mode === "row") {
            if (!n.layoutGrow && n.layoutSizingHorizontal === "FIXED") {
                dimensions.width = n.absoluteBoundingBox.width;
            }
            if (n.layoutAlign !== "STRETCH" && n.layoutSizingVertical === "FIXED") {
                dimensions.height = n.absoluteBoundingBox.height;
            }
        } else if (mode === "column") {
            if (n.layoutAlign !== "STRETCH" && n.layoutSizingHorizontal === "FIXED") {
                dimensions.width = n.absoluteBoundingBox.width;
            }
            if (!n.layoutGrow && n.layoutSizingVertical === "FIXED") {
                dimensions.height = n.absoluteBoundingBox.height;
            }

            if (n.preserveRatio && n.absoluteBoundingBox?.height && n.absoluteBoundingBox.height > 0) {
                dimensions.aspectRatio =
                    n.absoluteBoundingBox.width / n.absoluteBoundingBox.height;
            }
        } else {
            if (!n.layoutSizingHorizontal || n.layoutSizingHorizontal === "FIXED") {
                dimensions.width = n.absoluteBoundingBox.width;
            }
            if (!n.layoutSizingVertical || n.layoutSizingVertical === "FIXED") {
                dimensions.height = n.absoluteBoundingBox.height;
            }
        }

        if (Object.keys(dimensions).length > 0) {
            if (dimensions.width) {
                dimensions.width = pixelRound(dimensions.width);
            }
            if (dimensions.height) {
                dimensions.height = pixelRound(dimensions.height);
            }
            layoutValues.dimensions = dimensions;
        }
    }

    return layoutValues;
}
