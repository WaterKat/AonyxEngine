import { type CipherGCMTypes, type CipherKey, randomBytes, createCipheriv, createDecipheriv } from 'crypto';


// MARK: ENVIRONMENT
export function requireEnvAs<K extends keyof typeof process.env>(type: 'string', key: K, fallback?: string): string;
export function requireEnvAs<K extends keyof typeof process.env>(type: 'number', key: K, fallback?: number): number;
export function requireEnvAs<K extends keyof typeof process.env>(type: 'boolean', key: K, fallback?: boolean): boolean;
export function requireEnvAs<K extends keyof typeof process.env>(type: 'string' | 'number' | 'boolean', key: K, fallback?: string | number | boolean): string | number | boolean {
    const raw = process.env[key];
    const value = raw?.trim();

    if (!value) {
        if (fallback !== undefined) {
            return fallback;
        }
        throw new Error(`Missing required environmental variable: "${key}".`);
    }

    switch (type) {
        case 'string':
            return value;
        case 'number': {
            const num = Number(value);
            if (!isNaN(num)) return num;
            if (fallback !== undefined) {
                console.warn(`Invalid number for "${key}". Using fallback value: "${fallback}".`);
                return fallback;
            }
            throw new Error(`Environment variable "${key}" must be a valid number.`);
        }
        case 'boolean': {
            const bool = value.toLowerCase();
            if (bool === 'true') return true;
            if (bool === 'false') return false;
            if (fallback !== undefined) {
                console.warn(`Invalid boolean for "${key}". Using fallback value: "${fallback}".`);
                return fallback;
            }
            throw new Error(`Environment variable "${key}" must be "true" or "false".`);
        }
        default:
            throw new Error(`Unknown type "${type}" for environmental variable: "${key}".`);
    }
}
export function isDev(): boolean {
    return process.env.NODE_ENV === 'development';
}

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

