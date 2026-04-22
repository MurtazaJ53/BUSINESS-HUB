/// <reference types="vite/client" />

// Raw file imports (used by migration system)
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
declare module 'sql.js';
declare module 'sql.js/dist/sql-wasm.js';
