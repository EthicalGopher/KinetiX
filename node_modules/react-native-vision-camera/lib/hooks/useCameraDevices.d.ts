import type { CameraDevice } from '../specs/inputs/CameraDevice.nitro';
/**
 * Get a list of all {@linkcode CameraDevice}s.
 *
 * @note It is recommended to use {@linkcode useCameraDevice | useCameraDevice(...)} if
 * you only need a single {@linkcode CameraDevice}, as a full list of available devices
 * can be heavy.
 */
export declare function useCameraDevices(): CameraDevice[];
