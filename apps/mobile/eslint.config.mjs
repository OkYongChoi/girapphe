import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['.expo/**', 'dist/**', 'node_modules/**', 'expo-env.d.ts']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
]);
