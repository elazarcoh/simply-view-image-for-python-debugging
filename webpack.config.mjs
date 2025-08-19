//@ts-check

"use strict";

import webpackExtensionConfig from "./webpack.extension.config.mjs";
import webpackWebviewConfig from "./webpack.webview.config.mjs";

const [extensionConfig] = webpackExtensionConfig;
const [webviewConfig, webview3rdParty] = webpackWebviewConfig;

export default [webviewConfig, extensionConfig, webview3rdParty];
