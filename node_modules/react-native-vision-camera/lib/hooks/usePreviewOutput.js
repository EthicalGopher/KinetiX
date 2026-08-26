import { useMemo } from 'react';
import { VisionCamera } from '../VisionCamera';
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
export function usePreviewOutput() {
    return useMemo(() => VisionCamera.createPreviewOutput(), []);
}
