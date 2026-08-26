import type { CameraPreviewOutput } from '../specs/outputs/CameraPreviewOutput.nitro';
/**
 * Use a {@linkcode CameraPreviewOutput} for rendering the Camera's live
 * preview on screen.
 *
 * The returned {@linkcode CameraPreviewOutput} can be connected to a
 * {@linkcode CameraSession} and then displayed using the `PreviewView`.
 *
 * @example
 * ```ts
 * const previewOutput = usePreviewOutput()
 * ```
 */
export declare function usePreviewOutput(): CameraPreviewOutput;
