import type { Node as FigmaDocumentNode } from "@figma/rest-api-spec";
import { BaseExtractor } from "./extractor-base";
import type { ExtractedNode, TraversalContext } from "./types";
import { hasValue } from "@shared/identity";

export class MetadataExtractor extends BaseExtractor {
    readonly name = "MetadataExtractor";

    extract(node: FigmaDocumentNode, result: ExtractedNode, _context: TraversalContext): void {
        if (hasValue("blendMode", node) && node.blendMode !== "PASS_THROUGH") {
            result.blendMode = node.blendMode;
        }

        if (hasValue("locked", node) && node.locked) {
            result.locked = true;
        }

        if (hasValue("visible", node)) {
            result.visible = node.visible;
        }

        if (hasValue("rotation", node)) {
            const rotation = node.rotation as number;
            if (Math.abs(rotation) > 0.001) {
                result.rotation = rotation;
            }
        }

        if (hasValue("exportSettings", node)) {
            const exportSettings = node.exportSettings as Array<{
                format: string;
                suffix?: string;
                constraint?: {
                    type: string;
                    value: number;
                };
            }>;
            if (exportSettings.length > 0) {
                result.exportSettings = exportSettings.map((setting) => ({
                    format: setting.format,
                    suffix: setting.suffix || "",
                    constraint: setting.constraint
                        ? {
                              type: setting.constraint.type,
                              value: setting.constraint.value,
                          }
                        : undefined,
                }));
            }
        }

        if (hasValue("constraints", node)) {
            const constraints = node.constraints as {
                horizontal: string;
                vertical: string;
            };
            result.constraints = {
                horizontal: constraints.horizontal,
                vertical: constraints.vertical,
            };
        }
    }
}

const metadataExtractorInstance = new MetadataExtractor();
export const metadataExtractor: (node: FigmaDocumentNode, result: ExtractedNode, context: TraversalContext) => void =
    (node, result, context) => {
        metadataExtractorInstance.extract(node, result, context);
    };

