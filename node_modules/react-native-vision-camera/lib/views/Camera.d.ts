import React, { type Ref } from 'react';
import type { ViewProps } from 'react-native';
import { type CameraProps } from '../hooks/useCamera';
import type { CameraController } from '../specs/CameraController.nitro';
import type { FocusOptions } from '../specs/common-types/FocusOptions';
import type { Point } from '../specs/common-types/Point';
import type { PreviewView, PreviewViewMethods, PreviewViewProps } from '../specs/views/PreviewView.nitro';
/**
 * A React-ref to the {@linkcode Camera} view.
 * @example
 * ```tsx
 * function App() {
 *   const camera = useRef<CameraRef>(null)
 *   return <Camera {...props} ref={camera} />
 * }
 * ```
 */
export interface CameraRef extends PreviewViewMethods, Pick<CameraController, 'resetFocus' | 'startZoomAnimation' | 'cancelZoomAnimation'> {
    /**
     * Focuses the Camera pipeline to the specified {@linkcode viewPoint}
     * relative to the Camera view's coordinate system using
     * the specified {@linkcode MeteringMode}s.
     * @param viewPoint The point in the view coordinate system to focus to.
     * @param options Options for the focus operation.
     * @throws If the Camera isn't ready yet.
     * @example
     * ```tsx
     * // Focus center
     * await camera.current.focusTo({ x: width / 2, y: height / 2 })
     * ```
     */
    focusTo(viewPoint: Point, options?: FocusOptions): Promise<void>;
    /**
     * Get the current {@linkcode CameraController}.
     * This property will be set after `onStarted`
     * has been called, and may change over time.
     */
    controller: CameraController | undefined;
    /**
     * Get a ref to the {@linkcode PreviewView},
     * or `undefined` if it has not yet been set.
     * This value is set after the first
     * mount, and usually won't change.
     */
    preview: PreviewView | undefined;
}
/**
 * Props for the {@linkcode Camera} component.
 *
 * Extends {@linkcode CameraProps} (the options for the underlying
 * {@linkcode useCamera} hook) with {@linkcode PreviewView}-specific options
 * and convenience props for gesture handling and animated values.
 */
export interface CameraViewProps extends CameraProps, Pick<ViewProps, 'style' | 'onLayout' | 'pointerEvents' | 'nativeID'>, Pick<PreviewViewProps, 'resizeMode' | 'implementationMode'> {
    /**
     * Called when the {@linkcode Camera}'s Preview
     * received its first Frame.
     */
    onPreviewStarted?: () => void;
    /**
     * Called when the {@linkcode Camera}'s Preview
     * stopped streaming Frames.
     */
    onPreviewStopped?: () => void;
    /**
     * Enables (or disables) the native pinch-to-zoom gesture.
     *
     * @throws If this property is enabled and {@linkcode CameraViewProps.zoom | zoom} is not `undefined`.
     * @default false
     */
    enableNativeZoomGesture?: boolean;
    /**
     * Enables (or disables) the native tap-to-focus gesture.
     *
     * @default false
     */
    enableNativeTapToFocusGesture?: boolean;
    /**
     * @see {@linkcode CameraRef}
     */
    ref?: Ref<CameraRef>;
}
declare function CameraImpl({ implementationMode, resizeMode, onPreviewStarted, onPreviewStopped, outputs, enableNativeZoomGesture, enableNativeTapToFocusGesture, ref, ...props }: CameraViewProps): React.ReactElement;
/**
 * The `<Camera />` component.
 *
 * This is a convenience wrapper around {@linkcode useCamera | useCamera(...)}
 * that adds a {@linkcode PreviewView}, wraps methods in a {@linkcode CameraRef},
 * and supports updating {@linkcode CameraViewProps.zoom | zoom} and
 * {@linkcode CameraViewProps.exposure | exposure} via
 * Reanimated {@linkcode SharedValue}s.
 *
 * @example
 * ```tsx
 * function App() {
 *   const camera = useRef<CameraRef>(null)
 *   const device = useCameraDevice('back')
 *   const photoOutput = usePhotoOutput()
 *
 *   return (
 *     <Camera
 *       style={StyleSheet.absoluteFill}
 *       ref={camera}
 *       device={device}
 *       outputs={[photoOutput]}
 *       isActive={true}
 *     />
 *   )
 * }
 * ```
 */
export declare const Camera: React.MemoExoticComponent<typeof CameraImpl>;
export {};
