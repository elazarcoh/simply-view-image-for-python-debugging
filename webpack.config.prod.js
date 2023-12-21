/* eslint-disable @typescript-eslint/no-var-requires */

const [extensionConfigDev, WebviewConfigDev] = require("./webpack.config");

/**@type {import('webpack').Configuration}*/
const prodConfig = {
    mode: "production",
    devtool: "source-map",
};
module.exports = [
    {
        ...extensionConfigDev,
        ...prodConfig,
    },
    {
        ...WebviewConfigDev,
        ...prodConfig,
    },
];
