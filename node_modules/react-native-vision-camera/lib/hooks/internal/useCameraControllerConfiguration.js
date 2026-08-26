import { useEffect, useMemo } from 'react';
import { useStableCallback } from './useStableCallback';
export function useCameraControllerConfiguration(controller, config, onError) {
    const memoizedConfig = useMemo(() => ({
        enableDistortionCorrection: config.enableDistortionCorrection,
        enableLowLightBoost: config.enableLowLightBoost,
        enableSmoothAutoFocus: config.enableSmoothAutoFocus,
    }), [
        config.enableDistortionCorrection,
        config.enableLowLightBoost,
        config.enableSmoothAutoFocus,
    ]);
    const stableOnError = useStableCallback(onError);
    useEffect(() => {
        if (controller == null)
            return;
        if (Object.values(memoizedConfig).every((v) => v == null)) {
            // all props are null, we can skip the configuration.
            return;
        }
        const load = async () => {
            try {
                await controller.configure(memoizedConfig);
            }
            catch (error) {
                stableOnError(error);
            }
        };
        load();
    }, [memoizedConfig, controller, stableOnError]);
}
