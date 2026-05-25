const path = require('path')
const { ModuleFederationPlugin } = require('webpack').container
const packageJson = require('./package.json')

module.exports = {
  entry: './src/configpanel/index',
  mode: 'production',
  output: {
    path: path.resolve(__dirname, 'public'),
    clean: false
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/,
        options: {
          configFile: path.resolve(__dirname, 'src/configpanel/tsconfig.json'),
          transpileOnly: true
        }
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx']
  },
  plugins: [
    new ModuleFederationPlugin({
      name: packageJson.name.replace(/[-@/]/g, '_'),
      library: {
        type: 'var',
        name: packageJson.name.replace(/[-@/]/g, '_')
      },
      filename: 'remoteEntry.js',
      exposes: {
        './PluginConfigurationPanel':
          './src/configpanel/PluginConfigurationPanel'
      },
      shared: {
        react: { singleton: true, requiredVersion: '^19' },
        'react-dom': { singleton: true, requiredVersion: '^19' }
      }
    })
  ]
}
