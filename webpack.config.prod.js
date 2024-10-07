/* eslint-disable @typescript-eslint/no-var-requires */

const [WebviewConfigDev, extensionConfigDev, Webview3rdPartyDev] = require("./webpack.config");

/**@type {import('webpack').Configuration}*/
const prodConfig = {
    mode: "production",
    devtool: "source-map",
};
module.exports = [
    {
        ...WebviewConfigDev,
        ...prodConfig,
    },
    {
        ...extensionConfigDev,
        ...prodConfig,
    },
    {
        ...Webview3rdPartyDev,
        ...prodConfig,
    },
];
