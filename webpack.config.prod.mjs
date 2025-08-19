import devConfigs from "./webpack.config.mjs";
const [WebviewConfigDev, extensionConfigDev, Webview3rdPartyDev] = devConfigs;

/**@type {import('webpack').Configuration}*/
const prodConfig = {
  mode: "production",
  devtool: "source-map",
};
export default [
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
