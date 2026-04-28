/**
 * ESLint configuration.
 *
 * Without TypeScript's compile-time checks, ESLint is our primary
 * quality gate. It catches typos, unused variables, undeclared globals,
 * and many bugs that strict TypeScript would catch automatically.
 */

export default [
  {
    files: ['src/**/*.js', 'prisma/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        globalThis: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    rules: {
      // ---------- Bug catchers ----------
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',
      'no-shadow': 'warn',

      // ---------- Best practices ----------
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-throw-literal': 'error',

      // ---------- Async safety ----------
      'no-async-promise-executor': 'error',
      'require-await': 'warn',

      // ---------- Style (light touch) ----------
      'no-console': 'off', // we use console.log/error intentionally
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', 'prisma/migrations/**'],
  },
];
