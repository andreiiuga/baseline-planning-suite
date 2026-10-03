import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'docs/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // One owner per piece of data: only an app's adapters may open its database.
    files: ['apps/*/src/**/*.{ts,tsx}'],
    ignores: ['apps/*/src/adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'idb', message: "Open databases only inside the app's adapters/ folder." },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'indexedDB', message: "Open databases only inside the app's adapters/ folder." },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'indexedDB',
          message: "Open databases only inside the app's adapters/ folder.",
        },
      ],
    },
  },
);
