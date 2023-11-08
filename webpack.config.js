//@ts-check
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

"use strict";

/** @typedef {import('webpack').Configuration} WebpackConfig **/

const webpack = require('webpack');
const ESLintPlugin = require("eslint-webpack-plugin");
const {
    VSCodeExtensionsPackageJsonGenerator,
} = require("vscode-extensions-json-generator/webpack");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const WasmPackPlugin = require("@wasm-tool/wasm-pack-plugin");
const HtmlWebpackPlugin = require('html-webpack-plugin');


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

// Config for extension source code (to be run in a Node-based context)
/** @type WebpackConfig */
const extensionConfig = {
    ...baseConfig,
    target: "node",
    entry: "./src/extension.ts",
    externals: {
        vscode: "commonjs vscode",
        sharp: "commonjs sharp",
    },
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
        path: dist,
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
    entry: "./src/webview-ui/main.ts",
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
        path: dist,
        filename: "webview.js",
        libraryTarget: "module",
        chunkFormat: "module",
    },
};

const rustWebviewConfig = {
    ...baseConfig,
    entry: {
        index: path.resolve(webviewPath, "index.js"),
    },
    output: {
        path: dist,
        filename: "webview.js"
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(webviewPath, "index.html")
        }),
        new WasmPackPlugin({
            crateDirectory: webviewPath,
            outDir: path.resolve(webviewPath, "pkg"),
            outName: "webview",
        }),
        // Have this example work in Edge which doesn't ship `TextEncoder` or
        // `TextDecoder` at this time.
        new webpack.ProvidePlugin({
          TextDecoder: ['text-encoding', 'TextDecoder'],
          TextEncoder: ['text-encoding', 'TextEncoder']
        })
    ],
    experiments: {
        asyncWebAssembly: true,
        syncWebAssembly: true,
    }
}


module.exports = [extensionConfig, rustWebviewConfig];
