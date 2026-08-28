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
        // babel-loader strips types and compiles JSX; the standalone
        // `typecheck` script still enforces types via tsc. ts-loader was
        // dropped because its compiler-API calls broke under TypeScript 7.
        test: /\.tsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          presets: [
            '@babel/preset-typescript',
            ['@babel/preset-react', { runtime: 'automatic' }]
          ]
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
