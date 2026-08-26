import { useEffect, useState } from 'react';
import { useCameraDeviceFactory } from './internal/useCameraDeviceFactory';
/**
 * Get a list of all available {@linkcode CameraExtension}s for this specific
 * {@linkcode CameraDevice}.
 * @example
 * ```ts
 * const device = useCameraDevice('back')
 * const extensions = useCameraDeviceExtensions(device)
 * // ...enable extension if available
 * ```
 */
export function useCameraDeviceExtensions(device) {
    const factory = useCameraDeviceFactory();
    const [extensions, setExtensions] = useState([]);
    useEffect(() => {
        if (device == null)
            return;
        if (factory == null)
            return;
        const load = async () => {
            const exts = await factory.getSupportedExtensions(device);
            setExtensions(exts);
        };
        load();
    }, [device, factory]);
    return extensions;
}
