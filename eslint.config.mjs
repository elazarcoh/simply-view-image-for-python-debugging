import antfu from '@antfu/eslint-config';

export default antfu(
  {
    formatters: true,
    stylistic: {
      indent: 2,
      quotes: 'single',
      semi: true,

    },
    gitignore: {
      files: [
        '.gitignore',
        'src/webview-ui/.gitignore',
      ],
    },
    ignores: [
      'icons',
      'example-plugin',
      'dist',
      '.yarn',
      'python_test',
    ],
  },
  {
    files: [
      'src/**/*.ts',
    ],

    rules: {
      'ts/no-explicit-any': ['error', { ignoreRestArgs: true }],
      'ts/no-non-null-assertion': 'error',
      'ts/no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },
  {
    files: [
      'tests/**/*.ts',
      'tests/**/*.js',
      '**/*.test.ts',
    ],
    rules: {
      'no-console': 'off',
      'node/prefer-global/process': 'off',
      'ts/no-require-imports': 'off',
      'ts/no-unused-expressions': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },
);
