import { useMemo } from 'react';
import { VisionCamera } from '../VisionCamera';
/**
 * Use a {@linkcode FrameRenderer}.
 *
 * A {@linkcode FrameRenderer} allows rendering
 * {@linkcode Frame}s to a
 * {@linkcode NativeFrameRendererView | <NativeFrameRendererView />}.
 *
 * @example
 * ```tsx
 * const frameRenderer = useFrameRenderer()
 * const frameOutput = useFrameOutput({
 *   onFrame(frame) {
 *     'worklet'
 *     frameRenderer.renderFrame(frame)
 *     frame.dispose()
 *   }
 * })
 *
 * return (
 *   <NativeFrameRendererView
 *     style={StyleSheet.absoluteFill}
 *     frameRenderer={frameRenderer}
 *   />
 * )
 * ```
 */
export function useFrameRenderer() {
    return useMemo(() => VisionCamera.createFrameRenderer(), []);
}
