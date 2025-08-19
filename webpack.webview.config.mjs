//@ts-check

"use strict";

/** @typedef {import('webpack').Configuration} WebpackConfig **/

import WasmPackPlugin from "@wasm-tool/wasm-pack-plugin";
import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import path from "path";
import { fileURLToPath } from "url";
import webpack from "webpack";
import WebpackShellPlugin from "webpack-shell-plugin-next";
const { ProvidePlugin } = webpack;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dist = path.resolve(__dirname, "dist");

const webviewPath = path.resolve(__dirname, "src/webview-ui");

/** @type WebpackConfig */
const baseConfig = {
  mode: "development",
  devtool: "inline-source-map",
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};

/** @type WebpackConfig */
const webview3rdParty = {
  ...baseConfig,
  name: "webview3rdParty",
  entry: {
    lethargy_ts: path.resolve(
      __dirname,
      "node_modules/lethargy-ts/lib/index.js",
    ),
  },
  output: {
    filename: "[name].js",
    library: {
      name: "[name]",
      type: "umd",
    },
  },
  resolve: {
    extensions: [".js"],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: ["babel-loader"],
      },
    ],
  },
};

// Config for webview source code
/** @type WebpackConfig */
const WebviewConfig = {
  ...baseConfig,
  name: "webview",
  entry: {
    index: path.resolve(webviewPath, "index.js"),
  },
  output: {
    path: dist,
    filename: "webview.js",
  },
  dependencies: ["webview3rdParty"],
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(webviewPath, "index.html"),
    }),
    new WasmPackPlugin({
      crateDirectory: webviewPath,
      outDir: path.resolve(webviewPath, "pkg"),
      outName: "webview",
    }),
    // Have this example work in Edge which doesn't ship `TextEncoder` or
    // `TextDecoder` at this time.
    new ProvidePlugin({
      TextDecoder: ["text-encoding", "TextDecoder"],
      TextEncoder: ["text-encoding", "TextEncoder"],
    }),
    new CopyPlugin({
      patterns: [
        {
          // node_modules/@vscode/codicons/dist/codicon.{ttf,css}
          from: path.posix.join(
            __dirname.replace(/\\/g, "/"),
            "node_modules",
            "@vscode",
            "codicons",
            "dist",
            "codicon.{ttf,css}",
          ),
          to: path.posix.join(
            __dirname.replace(/\\/g, "/"),
            "dist",
            "[name][ext]",
          ),
        },
        {
          // icons/dist/svifpd-icons.{woff2,css}
          from: path.posix.join(
            __dirname.replace(/\\/g, "/"),
            "icons",
            "dist",
            "svifpd-icons.{woff2,css}",
          ),
          to: path.posix.join(
            __dirname.replace(/\\/g, "/"),
            "dist",
            "[name][ext]",
          ),
        },
        {
          // webview-ui/main.css
          from: path.posix.join(webviewPath.replace(/\\/g, "/"), "main.css"),
          to: path.posix.join(
            __dirname.replace(/\\/g, "/"),
            "dist",
            "webview-ui.css",
          ),
        },
      ],
    }),
    new WebpackShellPlugin({
      onBuildStart: {
        scripts: [
          "lodash --output dist/lodash.js --production include=debounce,throttle --silent",
        ],
        blocking: false,
      },
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
    syncWebAssembly: true,
  },
};

export default [WebviewConfig, webview3rdParty];
