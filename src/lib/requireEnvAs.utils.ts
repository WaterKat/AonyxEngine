//type requiredEnvKeysType = keyof typeof process.env;
type requiredEnvKeysType = string;

const requiredEnvKeys: requiredEnvKeysType[] = [];
export function requireEnvAs<K extends requiredEnvKeysType>(type: 'string', key: K, fallback?: string): string;
export function requireEnvAs<K extends requiredEnvKeysType>(type: 'number', key: K, fallback?: number): number;
export function requireEnvAs<K extends requiredEnvKeysType>(type: 'boolean', key: K, fallback?: boolean): boolean;
export function requireEnvAs<K extends requiredEnvKeysType>(type: 'string' | 'number' | 'boolean', key: K, fallback?: string | number | boolean): string | number | boolean {
    // Only add to requiredEnvKeys if we're in dev
    if (process.env.NODE_ENV === 'development' && fallback === undefined) {
        if (!requiredEnvKeys.includes(key)) {
            requiredEnvKeys.push(key);
        }
    }

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
export function getRequiredEnvKeys(): requiredEnvKeysType[] {
    if (process.env.NODE_ENV === 'development') {
        return requiredEnvKeys;
    }
    return [];
}
