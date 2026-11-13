import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
