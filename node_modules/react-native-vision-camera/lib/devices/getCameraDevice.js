/**
 * Get the best matching Camera device that best satisfies your requirements using a sorting filter,
 * or `undefined` if not Cameras are available on this platform.
 *
 * If this platform has any Cameras at the given {@linkcode position}, this method will always return
 * a Camera device, so {@linkcode filter} never excludes cameras.
 *
 * @param position The position of the Camera device relative to the phone.
 * @param filter The filter you want to use. The Camera device that matches your filter the closest will be returned
 * @returns The Camera device that matches your filter the closest, or `undefined` if no Camera Device exists on this platform.
 * @example
 * ```ts
 * const device = getCameraDevice(devices, 'back', {
 *    physicalDevices: ['wide-angle']
 * })
 * ```
 */
export function getCameraDevice(deviceFactory, position, filter = {}) {
    if (Object.values(filter).length === 0) {
        // No `filter` was passed, so let's just get the default Camera Device at that position!
        const defaultCamera = deviceFactory.getDefaultCamera(position);
        if (defaultCamera != null) {
            return defaultCamera;
        }
    }
    // We have a `filter`, or there is no default Camera Device - so let's get all devices and rank
    const devices = deviceFactory.cameraDevices;
    return devices
        .filter((d) => d.position === position)
        .reduce((prev, curr) => {
        if (prev == null)
            return curr;
        let prevPoints = 0;
        let currPoints = 0;
        const physicalDevicesFilter = (filter.physicalDevices ?? [
            'wide-angle',
        ]);
        // user did pass a physical device filter, two possible scenarios:
        // 1. user wants all cameras ([ultra-wide, wide, tele]) to zoom. prefer those devices that have all 3 cameras.
        // 2. user wants only one ([wide]) for faster performance. prefer those devices that only have one camera, if they have more, we rank them lower.
        for (const physicalCamera of prev.physicalDevices) {
            if (physicalDevicesFilter.includes(physicalCamera.type))
                prevPoints += 1;
            else
                prevPoints -= 1;
        }
        for (const physicalCamera of curr.physicalDevices) {
            if (physicalDevicesFilter.includes(physicalCamera.type))
                currPoints += 1;
            else
                currPoints -= 1;
        }
        if (currPoints > prevPoints)
            return curr;
        else
            return prev;
    }, undefined);
}
