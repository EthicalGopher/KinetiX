import type { CameraController } from '../../specs/CameraController.nitro';
import type { TorchMode } from '../../specs/common-types/TorchMode';
export declare function useTorchModeUpdater(controller: CameraController | undefined, torchMode: TorchMode | undefined, onError: (error: Error) => void): void;
