import type { TargetCameraPosition } from './specs/common-types/CameraPosition';
import type { ListenerSubscription } from './specs/common-types/ListenerSubscription';
import type { CameraDevice } from './specs/inputs/CameraDevice.nitro';
import type { CameraExtension } from './specs/inputs/CameraExtension.nitro';
/**
 * Returns all {@linkcode CameraDevice}s currently available on this phone.
 *
 * This is a synchronous snapshot - it only contains devices that have already been
 * discovered. If you want to reactively listen to device changes (e.g. when a
 * USB Camera is plugged in or out), use {@linkcode addOnCameraDevicesChangedListener}
 * or the {@linkcode useCameraDevices} hook instead.
 *
 * @see {@linkcode useCameraDevices}
 * @see {@linkcode getCameraDevice}
 * @deprecated Use the hooks API, or call `VisionCamera.createDeviceFactory()` yourself.
 */
export declare function getAllCameraDevices(): CameraDevice[];
/**
 * Returns the default {@linkcode CameraDevice} for the given {@linkcode CameraPosition}.
 *
 * This is usually the physical wide-angle Camera on the respective side of the device.
 * If no Camera is available on the given position, this returns `undefined`.
 *
 * @see {@linkcode getCameraDevice}
 * @deprecated Use the hooks API, or call `VisionCamera.createDeviceFactory()` yourself.
 */
export declare function getDefaultCameraDevice(position: TargetCameraPosition): Promise<CameraDevice | undefined>;
/**
 * Adds a listener that gets called whenever the list of available
 * {@linkcode CameraDevice}s changes - for example when a USB Camera is plugged in or out.
 *
 * The returned {@linkcode ListenerSubscription} must be removed via
 * {@linkcode ListenerSubscription.remove | remove()} when no longer needed.
 *
 * @see {@linkcode useCameraDevices}
 * @deprecated Use the hooks API, or call `VisionCamera.createDeviceFactory()` yourself.
 */
export declare function addOnCameraDevicesChangedListener(listener: (newDevices: CameraDevice[]) => void): ListenerSubscription;
/**
 * Returns all {@linkcode CameraExtension}s supported by the given {@linkcode CameraDevice}.
 *
 * Extensions are vendor-specific Camera modes (such as HDR, Night, or Bokeh)
 * implemented in the device's ISP pipeline.
 *
 * @platform Android
 * @see {@linkcode useCameraDeviceExtensions}
 * @see {@linkcode CameraExtension}
 * @deprecated Use the hooks API, or call `VisionCamera.createDeviceFactory()` yourself.
 */
export declare function getSupportedExtensions(device: CameraDevice): Promise<CameraExtension[]>;
