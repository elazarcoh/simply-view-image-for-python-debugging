// @ts-check

'use strict';

/** @typedef {import('webpack').Configuration} WebpackConfig */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ESLintPlugin from 'eslint-webpack-plugin';
import { VSCodeExtensionsPackageJsonGenerator } from 'vscode-extensions-json-generator/webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dist = path.resolve(__dirname, 'dist');

/** @type WebpackConfig */
const baseConfig = {
  mode: 'development',
  devtool: 'inline-source-map',
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },
};

// Config for extension source code (to be run in a Node-based context)
/** @type WebpackConfig */
const extensionConfig = {
  ...baseConfig,
  name: 'extension',
  target: 'node',
  entry: './src/extension.ts',
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: [/node_modules/, /webview-ui/],
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.py$/i,
        type: 'asset/source',
      },
    ],
  },
  output: {
    path: dist,
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  plugins: [
    new ESLintPlugin(),
    new VSCodeExtensionsPackageJsonGenerator('vscode-ext-config.json'),
  ],
  dependencies: ['webview'],
};

export default [extensionConfig];
