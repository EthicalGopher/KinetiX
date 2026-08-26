import type { CameraSession } from '../../specs/session/CameraSession.nitro';
interface Props {
    enableMultiCamSupport: boolean;
    onError: (error: Error) => void;
}
export declare function useCameraSession({ enableMultiCamSupport, onError, }: Props): CameraSession | undefined;
export {};
