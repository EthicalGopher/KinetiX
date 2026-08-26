import type { CameraController } from '../../specs/CameraController.nitro';
import type { TargetCameraPosition } from '../../specs/common-types/CameraPosition';
import type { Constraint } from '../../specs/common-types/Constraint';
import type { MirrorMode } from '../../specs/common-types/MirrorMode';
import type { CameraDevice } from '../../specs/inputs/CameraDevice.nitro';
import type { CameraOutput } from '../../specs/outputs/CameraOutput.nitro';
import type { CameraSession } from '../../specs/session/CameraSession.nitro';
import type { CameraSessionConfig } from '../../specs/session/CameraSessionConfig.nitro';
import type { CameraSessionConfiguration } from '../../specs/session/CameraSessionConfiguration';
interface Config extends CameraSessionConfiguration {
    mirrorMode?: MirrorMode;
    constraints?: Constraint[];
    onSessionConfigSelected?: (config: CameraSessionConfig) => void;
    onError: (error: Error) => void;
    onConfigured?: () => void;
    getInitialZoom?: () => number | undefined;
    getInitialExposureBias?: () => number | undefined;
}
/**
 * Connect the given {@linkcode device} to the given {@linkcode outputs}
 * with the given {@linkcode mirrorMode}  applied to each output,
 * and return a {@linkcode CameraController}.
 *
 * @note The {@linkcode outputs} have to be explicitly memoized.
 */
export declare function useCameraController(session: CameraSession | undefined, device: CameraDevice | TargetCameraPosition | undefined, outputs: CameraOutput[], { mirrorMode, constraints, onSessionConfigSelected, allowBackgroundAudioPlayback, allowHapticsAndSystemSoundsPlayback, getInitialExposureBias, onError, onConfigured, getInitialZoom, }: Config): CameraController | undefined;
export {};
