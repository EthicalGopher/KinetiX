import type { CameraPhotoOutput, PhotoOutputOptions } from '../specs/outputs/CameraPhotoOutput.nitro';
/**
 * Use a {@linkcode CameraPhotoOutput} for capturing {@linkcode Photo}s.
 *
 * The returned {@linkcode CameraPhotoOutput} can be passed to a
 * {@linkcode Camera} to enable photo capture. Photos can then be captured
 * via {@linkcode CameraPhotoOutput.capturePhoto | capturePhoto(...)}.
 *
 * @example
 * ```ts
 * const photoOutput = usePhotoOutput({
 *   targetResolution: CommonResolutions.UHD_4_3,
 *   qualityPrioritization: 'quality',
 * })
 *
 * // ...
 * const photo = await photoOutput.capturePhoto({ flashMode: 'on' }, {})
 * // ...
 * photo.dispose()
 * ```
 */
export declare function usePhotoOutput({ targetResolution, containerFormat, quality, qualityPrioritization, previewImageTargetSize, }?: Partial<PhotoOutputOptions>): CameraPhotoOutput;
