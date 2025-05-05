type SafelyResultSuccess<T> = { ok: true; data: T; };
type SafelyResultFailure = { ok: false; error: Error; };
export type SafelyResult<T> = SafelyResultSuccess<T> | SafelyResultFailure;

export function safelyRun<K extends (...args: any[]) => any>(func: K, ...args: Parameters<K>): SafelyResult<ReturnType<K>> {
    try {
        return { ok: true, data: func(...args) };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
}

export async function safelyRunAsync<K extends (...args: any[]) => Promise<any>>(func: K, ...args: Parameters<K>): Promise<SafelyResult<Awaited<ReturnType<K>>>> {
    try {
        return { ok: true, data: await func(...args) };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
}

export async function safelyUnwrapPromise<K>(promise: Promise<K>): Promise<SafelyResult<K>> {
    try {
        return { ok: true, data: await promise };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
}

export async function safelyWrapError(message: string, e: SafelyResultFailure | Error): Promise<SafelyResultFailure> {
    return { ok: false, error: new Error(message, { cause: e instanceof Error ? e : e.error }) };
}

export function safelyOK<K extends any>(data?: K): SafelyResult<K> {
    return { ok: true, data };
}

export function safelyThrowError(e: Error | string = 'unknown'): SafelyResultFailure {
    return { ok: false, error: e instanceof Error ? e : new Error(e) };
}
