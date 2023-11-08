//@ts-check
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

"use strict";

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const ESLintPlugin = require("eslint-webpack-plugin");

const {
    VSCodeExtensionsPackageJsonGenerator,
} = require("vscode-extensions-json-generator/webpack");

const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const path = require("path");

/** @type WebpackConfig */
const baseConfig = {
    mode: "development",
    devtool: "inline-source-map",
    externals: {
        vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded.
    },
    infrastructureLogging: {
        level: "log", // enables logging required for problem matchers
    },
};

// Config for extension source code (to be run in a Node-based context)
/** @type WebpackConfig */
const extensionConfig = {
    ...baseConfig,
    target: "node",
    entry: "./src/extension.ts",
    externals: ["vscode"],
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: [/node_modules/, /webview-ui/],
                use: [
                    {
                        loader: "ts-loader",
                    },
                ],
            },
            {
                test: /\.py$/i,
                type: "asset/source",
            },
        ],
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    plugins: [
        new ESLintPlugin({
            extensions: ["ts"],
        }),
        new VSCodeExtensionsPackageJsonGenerator("vscode-ext-config.json"),
    ],
};

// Config for webview source code (to be run in a web-based context)
/** @type WebpackConfig */
const webviewConfig = {
    ...baseConfig,
    target: ["web", "es2020"],
    entry: "./webview-ui/src/index.tsx",
    experiments: { outputModule: true },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx", ".css"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: [
                    {
                        loader: "ts-loader",
                        options: {
                            compilerOptions: {
                                noEmit: false,
                            },
                        },
                    },
                ],
                exclude: "/node_modules/",
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "webview.css",
        }),
        // new ESLintPlugin({ extensions: ["ts", "tsx"], }),
    ],
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "webview.js",
        libraryTarget: "module",
        chunkFormat: "module",
    },
};

module.exports = [extensionConfig, webviewConfig];
