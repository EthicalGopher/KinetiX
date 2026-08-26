import type { CameraOrientation } from '../specs/common-types/CameraOrientation';
import type { OrientationSource } from '../specs/common-types/OrientationSource';
/**
 * Reactively use the current {@linkcode source} {@linkcode CameraOrientation}.
 * - {@linkcode OrientationSource | 'interface'} will listen to UI-orientation.
 * - {@linkcode OrientationSource | 'device'} will listen to physical phone orientation.
 * - `undefined` will return `undefined` and not listen to anything.
 *
 * @example
 * ```ts
 * const orientation = useOrientation('device')
 * // orientation: 'up' | 'right' | 'down' | 'left' | undefined
 * ```
 */
export declare function useOrientation(source: OrientationSource | undefined): CameraOrientation | undefined;
