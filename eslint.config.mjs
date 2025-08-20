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
);
