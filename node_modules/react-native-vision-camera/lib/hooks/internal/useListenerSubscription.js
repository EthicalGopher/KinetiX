import { useLayoutEffect } from 'react';
import { useStableCallback } from './useStableCallback';
/**
 * Attaches the listener subscription ({@linkcode callback}) to the
 * function ({@linkcode subscriberFuncName}) on the {@linkcode object}.
 * When this component unmounts (or the params change), the listener
 * will be removed.
 */
export function useListenerSubscription(object, subscriberFuncName, callback) {
    const stableCallback = useStableCallback(callback);
    // Subscribe during layout so passive effects (e.g. start/stop) cannot emit before listeners are attached.
    useLayoutEffect(() => {
        if (object == null)
            return;
        if (stableCallback == null)
            return;
        const listener = object[subscriberFuncName](stableCallback);
        return () => listener.remove();
    }, [stableCallback, object, subscriberFuncName]);
}
