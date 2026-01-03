import type {
    GetFileResponse,
    GetFileNodesResponse,
    Node as FigmaDocumentNode,
    Component,
    ComponentSet,
    Style,
} from "@figma/rest-api-spec";
import { simplifyComponents, simplifyComponentSets } from "@transformers/component";
import { isVisible } from "@shared/common";
import type {
    TraversalOptions,
    ExtractedDesign,
    TraversalContext,
    ExtractedNode,
} from "./types";
import type { BaseExtractor, ExtractorFn } from "./extractor-base";
import { extractFromDesign } from "./node-walker";

export function simplifyRawFigmaObject(
    apiResponse: GetFileResponse | GetFileNodesResponse,
    nodeExtractors: (BaseExtractor | ExtractorFn)[],
    options: TraversalOptions = {},
): ExtractedDesign {
    const { metadata, rawNodes, components, componentSets, extraStyles } =
        parseAPIResponse(apiResponse);

    const globalVars: TraversalContext["globalVars"] = { styles: {}, extraStyles };
    const { nodes: extractedNodes, globalVars: finalGlobalVars } = extractFromDesign(
        rawNodes,
        nodeExtractors,
        options,
        globalVars,
    );

    const componentsWithInferredProps = inferVariantOptionsFromInstances(
        components,
        componentSets,
        extractedNodes,
    );

    return {
        ...metadata,
        nodes: extractedNodes,
        components: simplifyComponents(componentsWithInferredProps),
        componentSets: simplifyComponentSets(componentSets, componentsWithInferredProps),
        globalVars: { styles: finalGlobalVars.styles },
    };
}

/**
 * Infer variant options from actual component instances in the design
 * This is a fallback when Figma API doesn't return componentPropertyDefinitions
 */
function inferVariantOptionsFromInstances(
    components: Record<string, Component>,
    componentSets: Record<string, ComponentSet>,
    extractedNodes: ExtractedNode[],
): Record<string, Component> {
    const variantValuesByComponent: Record<
        string,
        Record<string, Set<string>>
    > = {};

    function traverseNodes(nodes: ExtractedNode[]): void {
        for (const node of nodes) {
            if (node.componentId && node.componentProperties) {
                if (!variantValuesByComponent[node.componentId]) {
                    variantValuesByComponent[node.componentId] = {};
                }

                for (const prop of node.componentProperties) {
                    if (prop.type === "VARIANT") {
                        if (!variantValuesByComponent[node.componentId][prop.name]) {
                            variantValuesByComponent[node.componentId][prop.name] = new Set();
                        }
                        variantValuesByComponent[node.componentId][prop.name].add(prop.value);
                    }
                }
            }

            if (node.children) {
                traverseNodes(node.children);
            }
        }
    }

    traverseNodes(extractedNodes);

    const enhancedComponents = { ...components };
    for (const [componentId, variantValues] of Object.entries(variantValuesByComponent)) {
        if (enhancedComponents[componentId]) {
            const comp = enhancedComponents[componentId] as Record<string, unknown>;
            if (!comp.componentPropertyDefinitions) {
                comp.componentPropertyDefinitions = {};
            }

            const propDefs = comp.componentPropertyDefinitions as Record<string, unknown>;
            for (const [propName, values] of Object.entries(variantValues)) {
                if (!propDefs[propName]) {
                    propDefs[propName] = {
                        name: propName,
                        type: "VARIANT",
                        variantOptions: Array.from(values),
                    };
                } else {
                    const existing = propDefs[propName] as Record<string, unknown>;
                    if (!existing.variantOptions || !Array.isArray(existing.variantOptions)) {
                        existing.variantOptions = Array.from(values);
                    } else {
                        const existingSet = new Set(existing.variantOptions as string[]);
                        values.forEach((v) => existingSet.add(v));
                        existing.variantOptions = Array.from(existingSet);
                    }
                }
            }
        }
    }

    return enhancedComponents;
}

function parseAPIResponse(data: GetFileResponse | GetFileNodesResponse) {
    const aggregatedComponents: Record<string, Component> = {};
    const aggregatedComponentSets: Record<string, ComponentSet> = {};
    let extraStyles: Record<string, Style> = {};
    let nodesToParse: Array<FigmaDocumentNode>;

    if ("nodes" in data) {
        const nodeResponses = Object.values(data.nodes);
        nodeResponses.forEach((nodeResponse) => {
            if (nodeResponse.components) {
                Object.assign(aggregatedComponents, nodeResponse.components);
            }
            if (nodeResponse.componentSets) {
                Object.assign(aggregatedComponentSets, nodeResponse.componentSets);
            }
            if (nodeResponse.styles) {
                Object.assign(extraStyles, nodeResponse.styles);
            }
        });
        nodesToParse = nodeResponses.map((n) => n.document).filter(isVisible);
    } else {
        Object.assign(aggregatedComponents, data.components);
        Object.assign(aggregatedComponentSets, data.componentSets);
        if (data.styles) {
            extraStyles = data.styles;
        }
        nodesToParse = data.document.children.filter(isVisible);
    }

    const { name } = data;

    return {
        metadata: {
            name,
        },
        rawNodes: nodesToParse,
        extraStyles,
        components: aggregatedComponents,
        componentSets: aggregatedComponentSets,
    };
}

