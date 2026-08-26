import { useEffect } from 'react';
import { getCameraDevice } from '../devices/getCameraDevice';
import { getUIRotation } from '../utils/getUIRotation';
import { useCameraController } from './internal/useCameraController';
import { useCameraControllerConfiguration } from './internal/useCameraControllerConfiguration';
import { useCameraSession } from './internal/useCameraSession';
import { useCameraSessionIsRunning } from './internal/useCameraSessionIsRunning';
import { useExposureUpdater } from './internal/useExposureUpdater';
import { useListenerSubscription } from './internal/useListenerSubscription';
import { useStableCallback } from './internal/useStableCallback';
import { useTorchModeUpdater } from './internal/useTorchModeUpdater';
import { useZoomUpdater } from './internal/useZoomUpdater';
import { useOrientation } from './useOrientation';
function defaultOnErrorHandler(error) {
    console.error(error);
}
function getAnimatableNumberInitialValue(value) {
    if (value == null)
        return undefined;
    else if (typeof value === 'number')
        return value;
    else
        return value.get();
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
export function useCamera({ isActive, device, outputs = [], constraints, onSessionConfigSelected, mirrorMode, onConfigured, allowBackgroundAudioPlayback, allowHapticsAndSystemSoundsPlayback, orientationSource = 'device', onStarted, onStopped, onError = defaultOnErrorHandler, onInterruptionStarted, onInterruptionEnded, onSubjectAreaChanged, onUIRotationChanged, enableDistortionCorrection, enableLowLightBoost, enableSmoothAutoFocus, zoom, exposure, torchMode, }) {
    // 1. Create session
    const session = useCameraSession({
        enableMultiCamSupport: false,
        onError: onError,
    });
    // TODO: Refactor our orientation logic here because it is problematic for multiple reasons;
    //       1. Avoid going through re-renders/React state to change orientation (2x useOrientation(..)) (slow)
    //       2. Avoid going through multiple setter calls here in a useEffect to set output orientation (possible race condition)
    //       3. Avoid having a static useOrientation(...) hook - instead, have a UI element (`<NativePreviewView />`) fire interface orientation listeners (multi-display support)
    //       4. orientationSource="custom" currently resorts back to 'up', which is not true - not sure if we just skip the callback or ignore instead?
    //       Instead, have orientation source be native/declarative so we can use `AVCaptureDevice.RotationCoordinator` and drive orientation from a preview without re-renders.
    // 2. Update output orientations
    const orientationSourceOrUndefined = orientationSource === 'custom' ? undefined : orientationSource;
    const orientation = useOrientation(orientationSourceOrUndefined);
    useEffect(() => {
        if (orientation == null)
            return;
        for (const output of outputs) {
            output.outputOrientation = orientation;
        }
    }, [orientation, outputs]);
    // 2.1. Call onUIRotationChanged listener
    const interfaceOrientation = useOrientation(onUIRotationChanged != null ? 'interface' : undefined);
    const uiRotation = getUIRotation(orientation ?? 'up', interfaceOrientation ?? 'up');
    const stableOnUIRotationChanged = useStableCallback(onUIRotationChanged);
    useEffect(() => {
        if (stableOnUIRotationChanged == null)
            return;
        stableOnUIRotationChanged(uiRotation);
    }, [stableOnUIRotationChanged, uiRotation]);
    // 4. Configure the session with the input + outputs to create a `CameraController`
    const controller = useCameraController(session, device, outputs, {
        mirrorMode: mirrorMode,
        onConfigured: onConfigured,
        getInitialExposureBias: () => getAnimatableNumberInitialValue(exposure),
        getInitialZoom: () => getAnimatableNumberInitialValue(zoom),
        constraints: constraints,
        onSessionConfigSelected: onSessionConfigSelected,
        allowBackgroundAudioPlayback: allowBackgroundAudioPlayback,
        allowHapticsAndSystemSoundsPlayback: allowHapticsAndSystemSoundsPlayback,
        onError: onError,
    });
    // 5. Configure the Controller with some settings
    useCameraControllerConfiguration(controller, {
        enableSmoothAutoFocus: enableSmoothAutoFocus,
        enableDistortionCorrection: enableDistortionCorrection,
        enableLowLightBoost: enableLowLightBoost,
    }, onError);
    // 6. Start (or stop) the Session if we have a Controller and `isActive` is true.
    const hasController = controller != null;
    useCameraSessionIsRunning(session, isActive && hasController, onError);
    // 7. Set up listeners and delegate to JS
    useListenerSubscription(session, 'addOnStartedListener', onStarted);
    useListenerSubscription(session, 'addOnStoppedListener', onStopped);
    useListenerSubscription(session, 'addOnErrorListener', onError);
    useListenerSubscription(session, 'addOnInterruptionStartedListener', onInterruptionStarted);
    useListenerSubscription(session, 'addOnInterruptionEndedListener', onInterruptionEnded);
    useListenerSubscription(controller, 'addSubjectAreaChangedListener', onSubjectAreaChanged);
    // 8. Update CameraController props
    useZoomUpdater(controller, zoom, onError);
    useExposureUpdater(controller, exposure, onError);
    useTorchModeUpdater(controller, torchMode, onError);
    // 9. Give the user the controller
    return controller;
}
