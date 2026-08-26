import { useEffect } from 'react';
import { useStableCallback } from './useStableCallback';
export function useCameraSessionIsRunning(session, isActive, onError) {
    const stableOnError = useStableCallback(onError);
    useEffect(() => {
        if (session == null)
            return;
        const load = async () => {
            try {
                if (isActive) {
                    await session.start();
                }
                else {
                    await session.stop();
                }
            }
            catch (error) {
                stableOnError(error);
            }
        };
        load();
    }, [isActive, session, stableOnError]);
}
