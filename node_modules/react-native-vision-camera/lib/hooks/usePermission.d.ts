import type { PermissionStatus } from '../specs/common-types/PermissionStatus';
/**
 * The state of a Camera or Microphone permission, as returned by
 * {@linkcode useCameraPermission} or {@linkcode useMicrophonePermission}.
 */
export interface PermissionState {
    /**
     * The current raw {@linkcode PermissionStatus}.
     */
    status: PermissionStatus;
    /**
     * Requests the permission from the user.
     *
     * Resolves with whether the permission was granted after the request completed.
     * Can only be called if {@linkcode canRequestPermission} is `true`.
     */
    requestPermission: () => Promise<boolean>;
    /**
     * Whether the app has been granted this permission ({@linkcode status} is
     * {@linkcode PermissionStatus | 'authorized'}).
     */
    hasPermission: boolean;
    /**
     * Whether the app can still request this permission ({@linkcode status} is
     * {@linkcode PermissionStatus | 'not-determined'}). If this is `false` but
     * {@linkcode hasPermission} is also `false`, the user must grant the
     * permission from the system Settings.
     */
    canRequestPermission: boolean;
}
/**
 * Use the Camera Permission.
 * @example
 * ```ts
 * const { hasPermission, requestPermission } = useCameraPermission()
 * useEffect(() => {
 *   if (!hasPermission) {
 *     requestPermission()
 *   }
 * }, [hasPermission, requestPermission])
 * ```
 */
export declare const useCameraPermission: () => PermissionState;
/**
 * Use the Microphone Permission.
 * @example
 * ```ts
 * const { hasPermission, requestPermission } = useMicrophonePermission()
 * useEffect(() => {
 *   if (!hasPermission) {
 *     requestPermission()
 *   }
 * }, [hasPermission, requestPermission])
 * ```
 */
export declare const useMicrophonePermission: () => PermissionState;
