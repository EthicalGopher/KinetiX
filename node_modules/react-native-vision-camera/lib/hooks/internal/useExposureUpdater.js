import { useEffect } from 'react';
import { VisionCameraWorkletsProxy } from '../../third-party/VisionCameraWorkletsProxy';
import { useStableCallback } from './useStableCallback';
export function useExposureUpdater(controller, exposure, onError) {
    const stableOnError = useStableCallback(onError);
    useEffect(() => {
        if (controller == null)
            return;
        if (exposure == null)
            return;
        if (typeof exposure === 'number') {
            // number
            controller.setExposureBias(exposure).catch(stableOnError);
            return;
        }
        else {
            // SharedValue<number>
            controller.setExposureBias(exposure.get()).catch(stableOnError);
            const listener = VisionCameraWorkletsProxy.bindUIUpdatesToController(exposure, controller, 'setExposureBias');
            return () => listener.remove();
        }
    }, [controller, exposure, stableOnError]);
}
