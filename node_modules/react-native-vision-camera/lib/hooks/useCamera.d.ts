import type { SharedValue } from 'react-native-reanimated';
import type { CameraController, CameraControllerConfiguration } from '../specs/CameraController.nitro';
import type { TargetCameraPosition } from '../specs/common-types/CameraPosition';
import type { Constraint } from '../specs/common-types/Constraint';
import type { MirrorMode } from '../specs/common-types/MirrorMode';
import type { OrientationSource } from '../specs/common-types/OrientationSource';
import type { TorchMode } from '../specs/common-types/TorchMode';
import type { CameraDevice } from '../specs/inputs/CameraDevice.nitro';
import type { CameraOutput } from '../specs/outputs/CameraOutput.nitro';
import type { InterruptionReason } from '../specs/session/CameraSession.nitro';
import type { CameraSessionConfig } from '../specs/session/CameraSessionConfig.nitro';
import type { CameraSessionConfiguration } from '../specs/session/CameraSessionConfiguration';
export interface CameraProps extends CameraSessionConfiguration, CameraControllerConfiguration {
    /**
     * Starts the {@linkcode CameraSession} when set to `true`, and stops it
     * when set back to `false`.
     *
     * @see {@linkcode CameraSession.start | CameraSession.start()}
     * @see {@linkcode CameraSession.stop | CameraSession.stop()}
     * @see {@linkcode CameraSession.isRunning}
     */
    isActive: boolean;
    /**
     * The {@linkcode CameraDevice} to open, or a {@linkcode TargetCameraPosition}
     * (e.g. `'back'`) to auto-pick a matching device via
     * {@linkcode getCameraDevice | getCameraDevice(...)}.
     *
     * @see {@linkcode CameraSessionConnection.input}
     */
    device: CameraDevice | TargetCameraPosition;
    /**
     * The {@linkcode CameraOutput}s the {@linkcode device} will stream into.
     *
     * @see {@linkcode CameraSessionConnection.outputs}
     * @see {@linkcode CameraOutputConfiguration.output}
     */
    outputs?: CameraOutput[];
    /**
     * {@linkcode Constraint}s (e.g. `{ fps: 60 }`) that the Camera pipeline
     * will try to match when configuring the {@linkcode CameraSession}.
     *
     * @see {@linkcode CameraSessionConnection.constraints}
     */
    constraints?: Constraint[];
    /**
     * Called once the given {@linkcode constraints} have been fully resolved
     * into a concrete {@linkcode CameraSessionConfig}.
     *
     * @see {@linkcode CameraSessionConnection.onSessionConfigSelected}
     */
    onSessionConfigSelected?: (config: CameraSessionConfig) => void;
    /**
     * Set a desired {@linkcode OrientationSource}
     * for automatically applying {@linkcode CameraOrientation}
     * to all {@linkcode outputs}, or `'custom'` if you
     * prefer to manually specify {@linkcode CameraOrientation}
     * yourself.
     *
     * @see {@linkcode CameraOutput.outputOrientation}
     */
    orientationSource?: OrientationSource | 'custom';
    /**
     * Called when the Camera Output orientation (driven
     * by {@linkcode orientationSource}) or the interface
     * orientation changes with a {@linkcode rotation} value
     * that specifies the degrees needed to rotate UI elements
     * such as Camera controls (flash button, Camera flip button)
     * so they appear upright.
     * @param rotation The degrees that UI elements need to be rotated by to appear up-right.
     */
    onUIRotationChanged?: (rotation: number) => void;
    /**
     * Sets whether the {@linkcode CameraOutput}s are mirrored along
     * the vertical axis. {@linkcode MirrorMode | 'auto'} mirrors
     * automatically on selfie cameras.
     *
     * @see {@linkcode CameraOutputConfiguration.mirrorMode}
     * @default 'auto'
     */
    mirrorMode?: MirrorMode;
    /**
     * Sets the {@linkcode CameraController.zoom | zoom} value declaratively.
     *
     * You can also imperatively set zoom via
     * {@linkcode CameraController.setZoom | setZoom(...)}.
     *
     * @note This property can be animated via Reanimated by passing a {@linkcode SharedValue}.
     * @default 1
     */
    zoom?: number | SharedValue<number>;
    /**
     * Sets the {@linkcode CameraController.exposureBias | exposureBias} value
     * declaratively.
     *
     * You can also imperatively set the exposure bias via
     * {@linkcode CameraController.setExposureBias | setExposureBias(...)}.
     *
     * @note This property can be animated via Reanimated by passing a {@linkcode SharedValue}.
     * @default 0
     */
    exposure?: number | SharedValue<number>;
    /**
     * Sets the {@linkcode CameraController.torchMode | torchMode} value
     * declaratively.
     * @default 'off'
     */
    torchMode?: TorchMode;
    /**
     * A getter for the initial zoom value to apply when the
     * {@linkcode CameraController} is created. Later, the zoom can be
     * adjusted via {@linkcode CameraController.setZoom | CameraController.setZoom(...)}.
     *
     * @see {@linkcode CameraSessionConnection.initialZoom}
     */
    getInitialZoom?: () => number | undefined;
    /**
     * A getter for the initial exposure bias to apply when the
     * {@linkcode CameraController} is created. Later, the exposure bias can be
     * adjusted via {@linkcode CameraController.setExposureBias | CameraController.setExposureBias(...)}.
     *
     * @see {@linkcode CameraSessionConnection.initialExposureBias}
     */
    getInitialExposureBias?: () => number | undefined;
    /**
     * Called whenever the {@linkcode CameraSession}
     * has been configured with new connections via
     * {@linkcode CameraSession.configure | configure(...)}
     * and connections to the individual outputs are formed.
     *
     * This is a good place to check output
     * capabilities, such as {@linkcode CameraVideoOutput.getSupportedVideoCodecs | CameraVideoOutput.getSupportedVideoCodecs()}
     */
    onConfigured?: () => void;
    /**
     * Called when the {@linkcode CameraSession}
     * has been started.
     *
     * @see {@linkcode CameraSession.addOnStartedListener}
     */
    onStarted?: () => void;
    /**
     * Called when the {@linkcode CameraSession}
     * has been stopped.
     *
     * @see {@linkcode CameraSession.addOnStoppedListener}
     */
    onStopped?: () => void;
    /**
     * Called whenever the {@linkcode CameraSession}
     * has encountered an error.
     *
     * @see {@linkcode CameraSession.addOnErrorListener}
     */
    onError?: (error: Error) => void;
    /**
     * Called whenever the {@linkcode CameraSession}
     * has encountered an interruption of the given
     * {@linkcode InterruptionReason}.
     * Interruptions are temporarily.
     *
     * @see {@linkcode CameraSession.addOnInterruptionStartedListener}
     */
    onInterruptionStarted?: (interruption: InterruptionReason) => void;
    /**
     * Called when a previous interruption
     * has ended and the {@linkcode CameraSession}
     * is running uninterrupted again.
     *
     * @see {@linkcode CameraSession.addOnInterruptionEndedListener}
     */
    onInterruptionEnded?: () => void;
    /**
     * Called when the subject area substantially changes,
     * e.g. when the user pans away from a scene that was
     * previously in focus.
     *
     * This is a good point to reset any locked AE/AF/AWB
     * focus states back to continuously auto-focus.
     *
     * @see {@linkcode CameraController.addSubjectAreaChangedListener}
     * @platform iOS
     */
    onSubjectAreaChanged?: () => void;
}
/**
 * Use the Camera.
 *
 * This creates a {@linkcode CameraSession}, manages
 * the input and outputs (including orientation and
 * mirror modes), wraps listeners as stable React
 * callbacks, and returns a {@linkcode CameraController}.
 *
 * @example
 * ```ts
 * const camera = useCamera({
 *   isActive: true,
 *   device: 'back',
 *   outputs: []
 * })
 * ```
 */
export declare function useCamera({ isActive, device, outputs, constraints, onSessionConfigSelected, mirrorMode, onConfigured, allowBackgroundAudioPlayback, allowHapticsAndSystemSoundsPlayback, orientationSource, onStarted, onStopped, onError, onInterruptionStarted, onInterruptionEnded, onSubjectAreaChanged, onUIRotationChanged, enableDistortionCorrection, enableLowLightBoost, enableSmoothAutoFocus, zoom, exposure, torchMode, }: CameraProps): CameraController | undefined;
