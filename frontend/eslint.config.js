import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  { files: ['e2e/**/*.js', '*.config.js'], languageOptions: { globals: globals.node } },
  // Change 05: icons come from components/ui/icons.js (react-icons/lu); custom SVGs only for the logo, decor art and charts.
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['src/components/ui/icons.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'lucide-react', message: 'Use components/ui/icons.js.' }],
        patterns: [{ group: ['react-icons/*'], message: 'Import icons from components/ui/icons.js.' }],
      }],
    },
  },
  {
    files: ['src/**/*.jsx'],
    ignores: ['src/components/ui/BeanMark.jsx', 'src/components/ui/Contours.jsx', 'src/components/dashboard/BarChart.jsx'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "JSXOpeningElement[name.name='svg']",
        message: 'No inline SVG icons: use components/ui/icons.js (react-icons/lu).',
      }],
    },
  },
])
