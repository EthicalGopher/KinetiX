/**
 * Returns a wrapper with a stable identity that always calls the latest
 * {@linkcode callback}. Re-renders that change only the {@linkcode callback}
 * reference do not change the returned identity.
 *
 * When {@linkcode callback} is `undefined` or `null`, the hook returns
 * that same nullish value. The returned identity therefore only changes
 * when {@linkcode callback} flips between "defined" and "nullish" — not
 * when the function itself changes — which makes it safe as a
 * `useEffect`/`useLayoutEffect` dependency.
 */
export declare function useStableCallback<T>(callback: T): T;
