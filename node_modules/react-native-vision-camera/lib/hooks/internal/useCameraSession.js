import { useEffect, useState } from 'react';
import { VisionCamera } from '../../VisionCamera';
import { useStableCallback } from './useStableCallback';
export function useCameraSession({ enableMultiCamSupport, onError, }) {
    const [session, setSession] = useState();
    const stableOnError = useStableCallback(onError);
    // session creation
    useEffect(() => {
        let isCanceled = false;
        const load = async () => {
            try {
                const s = await VisionCamera.createCameraSession(enableMultiCamSupport);
                if (isCanceled) {
                    s.dispose();
                    return;
                }
                setSession(s);
            }
            catch (error) {
                stableOnError(error);
            }
        };
        load();
        return () => {
            isCanceled = true;
        };
    }, [enableMultiCamSupport, stableOnError]);
    // session teardown
    useEffect(() => {
        return () => {
            // remove all connections
            session?.stop();
            session?.configure([]);
        };
    }, [session]);
    return session;
}
