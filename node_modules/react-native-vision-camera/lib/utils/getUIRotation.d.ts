import type { CameraOrientation } from '../specs/common-types/CameraOrientation';
/**
 * Gets the signed rotation needed to keep UI elements upright relative to the
 * Camera output orientation.
 *
 * The result is normalized to the shortest cardinal rotation, with opposite
 * orientations represented as `180`.
 */
export declare function getUIRotation(outputOrientation: CameraOrientation, interfaceOrientation: CameraOrientation): number;
