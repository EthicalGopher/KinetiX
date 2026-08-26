export declare function createPromiseHook<T>(createPromise: () => Promise<T>): () => T | undefined;
