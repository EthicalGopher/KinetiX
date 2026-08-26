import { useEffect } from 'react';
import { useStableCallback } from './useStableCallback';
export function useTorchModeUpdater(controller, torchMode, onError) {
    const stableOnError = useStableCallback(onError);
    useEffect(() => {
        if (controller == null)
            return;
        if (torchMode == null)
            return;
        controller.setTorchMode(torchMode).catch(stableOnError);
    }, [controller, torchMode, stableOnError]);
}
