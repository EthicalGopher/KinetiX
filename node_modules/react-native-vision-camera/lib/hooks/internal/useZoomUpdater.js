import { useEffect } from 'react';
import { VisionCameraWorkletsProxy } from '../../third-party/VisionCameraWorkletsProxy';
import { useStableCallback } from './useStableCallback';
export function useZoomUpdater(controller, zoom, onError) {
    const stableOnError = useStableCallback(onError);
    useEffect(() => {
        if (controller == null)
            return;
        if (zoom == null)
            return;
        if (typeof zoom === 'number') {
            // number
            controller.setZoom(zoom).catch(stableOnError);
            return;
        }
        else {
            // SharedValue<number>
            controller.setZoom(zoom.get()).catch(stableOnError);
            const listener = VisionCameraWorkletsProxy.bindUIUpdatesToController(zoom, controller, 'setZoom');
            return () => listener.remove();
        }
    }, [controller, zoom, stableOnError]);
}
