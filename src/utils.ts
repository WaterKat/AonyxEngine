import { type CipherGCMTypes, type CipherKey, randomBytes, createCipheriv, createDecipheriv } from 'crypto';


// MARK: SAFELY
type SafelyResultSuccess<T> = { data: T; error: undefined; };
type SafelyResultFailure = { data: undefined; error: Error; };
export type SafelyResult<T> = SafelyResultSuccess<T> | SafelyResultFailure;

export function safelyRun<K extends (...args: any[]) => any>(func: K, ...args: Parameters<K>): SafelyResult<ReturnType<K>> {
    try {
        return { data: func(...args), error: undefined };
    } catch (e) {
        return { data: undefined, error: e instanceof Error ? e : new Error(String(e)) };
    }
}

export async function safelyRunAsync<K extends (...args: any[]) => Promise<any>>(func: K, ...args: Parameters<K>): Promise<SafelyResult<Awaited<ReturnType<K>>>> {
    try {
        return { data: await func(...args), error: undefined };
    } catch (e) {
        return { data: undefined, error: e instanceof Error ? e : new Error(String(e)) };
    }
}


// MARK: ENCRYPTION
export function encryptToken(payload: string, algorithm: CipherGCMTypes, key: CipherKey): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(algorithm, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(payload, 'utf-8'),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag(); // 16 bytes

    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptToken(encryptedString: string, algorithm: CipherGCMTypes, key: CipherKey): string {
    const data = Buffer.from(encryptedString, 'base64');

    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);

    const decipher = createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);

    return decrypted.toString('utf-8');
}


// MARK: UTILS
export function arrayIsEqual(a: any[], b: any[]): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    const c = Array.from(a).sort();
    const d = Array.from(b).sort();

    for (let i = 0; i < c.length; i++) {
        if (c[i] !== d[i]) return false;
    }

    return true;
}

