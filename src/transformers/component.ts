import type {
    Component,
    ComponentPropertyType,
    ComponentSet,
} from "@figma/rest-api-spec";

export interface ComponentProperties {
    name: string;
    value: string;
    type: ComponentPropertyType;
}

export interface ComponentPropertyDefinitionSimplified {
    name: string;
    type: ComponentPropertyType;
    defaultValue?: string | boolean | number;
    variantOptions?: string[]; // For VARIANT type, list all possible values
    preferredValues?: (string | number)[]; // For other types
}

export interface SimplifiedComponentDefinition {
    id: string;
    key: string;
    name: string;
    componentSetId?: string;
    propertyDefinitions?: ComponentPropertyDefinitionSimplified[]; // All possible properties (inferred from instances)
}

export interface SimplifiedComponentSetDefinition {
    id: string;
    key: string;
    name: string;
    description?: string;
    propertyDefinitions?: ComponentPropertyDefinitionSimplified[]; // Properties inferred from component instances
    variantCount?: number; // Number of variants in the set
}

// Helper to safely extract property definitions from component/componentSet
// Note: Figma API may not always include componentPropertyDefinitions in the response
// So we'll infer them from actual component instances when available
function extractPropertyDefinitionFromRaw(
    propDef: unknown,
): ComponentPropertyDefinitionSimplified | null {
    if (!propDef || typeof propDef !== "object") return null;

    const def = propDef as Record<string, unknown>;

    if (!def.type || typeof def.name !== "string") return null;

    const result: ComponentPropertyDefinitionSimplified = {
        name: def.name as string,
        type: def.type as ComponentPropertyType,
    };

    if ("defaultValue" in def && def.defaultValue !== undefined) {
        result.defaultValue = def.defaultValue as string | boolean | number;
    }

    if (def.type === "VARIANT" && "variantOptions" in def && Array.isArray(def.variantOptions)) {
        result.variantOptions = def.variantOptions as string[];
    }

    if ("preferredValues" in def && Array.isArray(def.preferredValues)) {
        result.preferredValues = def.preferredValues as (string | number)[];
    }

    return result;
}

export function simplifyComponents(
    aggregatedComponents: Record<string, Component>,
): Record<string, SimplifiedComponentDefinition> {
    return Object.fromEntries(
        Object.entries(aggregatedComponents).map(([id, comp]) => {
            const simplified: SimplifiedComponentDefinition = {
                id,
                key: comp.key,
                name: comp.name,
                componentSetId: comp.componentSetId,
            };

            const rawComp = comp as Record<string, unknown>;
            if (rawComp.componentPropertyDefinitions && typeof rawComp.componentPropertyDefinitions === "object") {
                const propDefs = rawComp.componentPropertyDefinitions as Record<string, unknown>;
                const extracted = Object.values(propDefs)
                    .map((propDef) => extractPropertyDefinitionFromRaw(propDef))
                    .filter((def): def is ComponentPropertyDefinitionSimplified => def !== null);
                if (extracted.length > 0) {
                    simplified.propertyDefinitions = extracted;
                }
            }

            return [id, simplified];
        }),
    );
}

export function simplifyComponentSets(
    aggregatedComponentSets: Record<string, ComponentSet>,
    components?: Record<string, Component>,
): Record<string, SimplifiedComponentSetDefinition> {
    return Object.fromEntries(
        Object.entries(aggregatedComponentSets).map(([id, set]) => {
            const simplified: SimplifiedComponentSetDefinition = {
                id,
                key: set.key,
                name: set.name,
                description: set.description,
            };

            const rawSet = set as Record<string, unknown>;
            if (rawSet.componentPropertyDefinitions && typeof rawSet.componentPropertyDefinitions === "object") {
                const propDefs = rawSet.componentPropertyDefinitions as Record<string, unknown>;
                const extracted = Object.values(propDefs)
                    .map((propDef) => extractPropertyDefinitionFromRaw(propDef))
                    .filter((def): def is ComponentPropertyDefinitionSimplified => def !== null);
                if (extracted.length > 0) {
                    simplified.propertyDefinitions = extracted;
                }
            }

            if (components) {
                const variantCount = Object.values(components).filter(
                    (comp) => comp.componentSetId === id,
                ).length;
                if (variantCount > 0) {
                    simplified.variantCount = variantCount;
                }
            }

            return [id, simplified];
        }),
    );
}
