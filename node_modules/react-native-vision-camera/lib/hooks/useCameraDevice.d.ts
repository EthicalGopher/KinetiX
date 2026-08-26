import type { DeviceFilter } from '../devices/getCameraDevice';
import type { TargetCameraPosition } from '../specs/common-types/CameraPosition';
import type { CameraDevice } from '../specs/inputs/CameraDevice.nitro';
/**
 * Get the best matching Camera device that best satisfies your requirements using a sorting {@linkcode filter},
 * or a default Camera device at the given {@linkcode position} if no {@linkcode filter} was passed.
 *
 * This hook is reactive to device changes. If a new device is plugged in, this hook updates.
 *
 * @param position The position of the Camera device relative to the phone.
 * @param filter The filter you want to use. The Camera device that matches your filter the closest will be returned
 * @returns The Camera device that matches your filter the closest, or `undefined` if no such Camera Device exists on the given {@linkcode position}.
 * @example
 * ```ts
 * const device = useCameraDevice('back', {
 *    physicalDevices: ['wide-angle']
 * })
 * ```
 */
export declare function useCameraDevice(position: TargetCameraPosition, filter?: DeviceFilter): CameraDevice | undefined;
