import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // `strict` still rejects implicit any. Existing provider adapters use
      // explicit `any` at untyped SDK boundaries; modeling those APIs is a
      // separate migration, not a safe mechanical lint rewrite.
      '@typescript-eslint/no-explicit-any': 'off',
      'react/no-unescaped-entities': 'off',
      // React Compiler is not enabled in this React 18 application. Keep the
      // core Hooks rules, but do not enforce compiler-only analyses.
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },
  // The panel is a legacy 18k-line component. React Compiler's whole-component
  // lint passes exceed Node's 4 GiB heap on this single file. Keep the core
  // Rules of Hooks checks enabled and suppress only those compiler analyses
  // until the panel is split into bounded components.
  {
    files: ['app/panel/panel-client.tsx'],
    rules: {
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-render': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'public/admin/**',
    'tina/__generated__/**',
    'scratch/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
]);
