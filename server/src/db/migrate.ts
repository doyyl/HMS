import { applySchema, closePool } from './index.js';

await applySchema();
console.log('✓ schema applied');
await closePool();
