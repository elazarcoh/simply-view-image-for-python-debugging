//@ts-check
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

"use strict";

const ESLintPlugin = require("eslint-webpack-plugin");

const {
  VSCodeExtensionsPackageJsonGenerator,
} = require("vscode-extensions-json-generator/webpack");

const path = require("path");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node",

  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "out"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded.
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  plugins: [
    // @ts-expect-error. it is constructible
    new ESLintPlugin({
      extensions: ["ts"],
    }),
    new VSCodeExtensionsPackageJsonGenerator("vscode-ext-config.json"),
  ],
};
module.exports = config;
