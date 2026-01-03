import fs from "fs";
import sharp from "sharp";
import type { Transform } from "@figma/rest-api-spec";
import { Logger } from "~/logger";
import { downloadFigmaImage } from "./common";

export async function applyCropTransform(
    imagePath: string,
    cropTransform: Transform,
): Promise<string> {
    try {
        // Extract transform values
        const scaleX = cropTransform[0]?.[0] ?? 1;
        const skewX = cropTransform[0]?.[1] ?? 0;
        const translateX = cropTransform[0]?.[2] ?? 0;
        const skewY = cropTransform[1]?.[0] ?? 0;
        const scaleY = cropTransform[1]?.[1] ?? 1;
        const translateY = cropTransform[1]?.[2] ?? 0;

        const image = sharp(imagePath);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            throw new Error(`Could not get image dimensions for ${imagePath}`);
        }

        const { width, height } = metadata;

        const cropLeft = Math.max(0, Math.round(translateX * width));
        const cropTop = Math.max(0, Math.round(translateY * height));
        const cropWidth = Math.min(width - cropLeft, Math.round(scaleX * width));
        const cropHeight = Math.min(height - cropTop, Math.round(scaleY * height));

        if (cropWidth <= 0 || cropHeight <= 0) {
            Logger.log(`Invalid crop dimensions for ${imagePath}, using original image`);
            return imagePath;
        }

        const tempPath = imagePath + ".tmp";

        await image
            .extract({
                left: cropLeft,
                top: cropTop,
                width: cropWidth,
                height: cropHeight,
            })
            .toFile(tempPath);

        fs.renameSync(tempPath, imagePath);

        Logger.log(`Cropped image saved (overwritten): ${imagePath}`);
        Logger.log(
            `Crop region: ${cropLeft}, ${cropTop}, ${cropWidth}x${cropHeight} from ${width}x${height}`,
        );

        return imagePath;
    } catch (error) {
        Logger.error(`Error cropping image ${imagePath}:`, error);
        return imagePath;
    }
}

export async function getImageDimensions(imagePath: string): Promise<{
    width: number;
    height: number;
}> {
    try {
        const metadata = await sharp(imagePath).metadata();

        if (!metadata.width || !metadata.height) {
            throw new Error(`Could not get image dimensions for ${imagePath}`);
        }

        return {
            width: metadata.width,
            height: metadata.height,
        };
    } catch (error) {
        Logger.error(`Error getting image dimensions for ${imagePath}:`, error);
        return { width: 1000, height: 1000 };
    }
}

export type ImageProcessingResult = {
    filePath: string;
    originalDimensions: { width: number; height: number };
    finalDimensions: { width: number; height: number };
    wasCropped: boolean;
    cropRegion?: { left: number; top: number; width: number; height: number };
    cssVariables?: string;
    processingLog: string[];
};

export async function downloadAndProcessImage(
    fileName: string,
    localPath: string,
    imageUrl: string,
    needsCropping: boolean = false,
    cropTransform?: Transform,
    requiresImageDimensions: boolean = false,
): Promise<ImageProcessingResult> {
    const processingLog: string[] = [];

    const originalPath = await downloadFigmaImage(fileName, localPath, imageUrl);
    Logger.log(`Downloaded original image: ${originalPath}`);

    const originalDimensions = await getImageDimensions(originalPath);
    Logger.log(`Original dimensions: ${originalDimensions.width}x${originalDimensions.height}`);

    let finalPath = originalPath;
    let wasCropped = false;
    let cropRegion: { left: number; top: number; width: number; height: number } | undefined;

    if (needsCropping && cropTransform) {
        Logger.log("Applying crop transform...");

        const scaleX = cropTransform[0]?.[0] ?? 1;
        const scaleY = cropTransform[1]?.[1] ?? 1;
        const translateX = cropTransform[0]?.[2] ?? 0;
        const translateY = cropTransform[1]?.[2] ?? 0;

        const cropLeft = Math.max(0, Math.round(translateX * originalDimensions.width));
        const cropTop = Math.max(0, Math.round(translateY * originalDimensions.height));
        const cropWidth = Math.min(
            originalDimensions.width - cropLeft,
            Math.round(scaleX * originalDimensions.width),
        );
        const cropHeight = Math.min(
            originalDimensions.height - cropTop,
            Math.round(scaleY * originalDimensions.height),
        );

        if (cropWidth > 0 && cropHeight > 0) {
            cropRegion = { left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight };
            finalPath = await applyCropTransform(originalPath, cropTransform);
            wasCropped = true;
            Logger.log(`Cropped to region: ${cropLeft}, ${cropTop}, ${cropWidth}x${cropHeight}`);
        } else {
            Logger.log("Invalid crop dimensions, keeping original image");
        }
    }

    const finalDimensions = await getImageDimensions(finalPath);
    Logger.log(`Final dimensions: ${finalDimensions.width}x${finalDimensions.height}`);

    let cssVariables: string | undefined;
    if (requiresImageDimensions) {
        cssVariables = generateImageCSSVariables(finalDimensions);
    }

    return {
        filePath: finalPath,
        originalDimensions,
        finalDimensions,
        wasCropped,
        cropRegion,
        cssVariables,
        processingLog,
    };
}

export function generateImageCSSVariables({
    width,
    height,
}: {
    width: number;
    height: number;
}): string {
    return `--original-width: ${width}px; --original-height: ${height}px;`;
}

