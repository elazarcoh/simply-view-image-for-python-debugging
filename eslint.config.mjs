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
);
