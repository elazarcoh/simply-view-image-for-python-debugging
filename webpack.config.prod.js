/* eslint-disable @typescript-eslint/no-var-requires */

const devConfig = require('./webpack.config');

/**@type {import('webpack').Configuration}*/
const config = {
    ...devConfig,
    mode: 'production',
    devtool: 'source-map',
};
module.exports = config;
