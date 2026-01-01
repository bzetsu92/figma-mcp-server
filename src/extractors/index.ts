export type { ExtractedDesign } from "./types";
export { simplifyRawFigmaObject } from "./design-extractor";

import { layoutExtractor } from "./layout-extractor";
import { textExtractor } from "./text-extractor";
import { visualsExtractor } from "./visuals-extractor";
import { componentExtractor } from "./component-extractor";
import { metadataExtractor } from "./metadata-extractor";
import { collapseSvgContainers } from "./helpers";

export const allExtractors = [
    layoutExtractor,
    textExtractor,
    visualsExtractor,
    componentExtractor,
    metadataExtractor,
];
export { collapseSvgContainers };
