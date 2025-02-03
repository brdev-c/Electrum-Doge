const path = require('path');

module.exports = {
  target: 'electron-main',
  mode: 'development',
  entry: './src/main/electron.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'electron-main.js'
  },
  externals: {
    '@ledgerhq/hw-transport': 'commonjs2 @ledgerhq/hw-transport',
    '@ledgerhq/hw-transport-node-hid': 'commonjs2 @ledgerhq/hw-transport-node-hid',
    '@ledgerhq/hw-transport-webusb': 'commonjs2 @ledgerhq/hw-transport-webusb',
    'usb': 'commonjs2 usb',
    'tiny-secp256k1': 'commonjs2 tiny-secp256k1',
    'node-hid': 'commonjs2 node-hid'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: { electron: '24' } }]
            ]
          }
        }
      }
    ]
  },
  optimization: {
    usedExports: false,
    minimize: false
  },
  node: {
    __dirname: false,
    __filename: false
  }
};
