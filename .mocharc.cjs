// Mocha's default spec glob (`test/*.ts`) does not recurse into
// subdirectories. The per-calc split keeps unit tests at the top of
// `test/` and groups the integration tests under `test/integration/`,
// so we need an explicit glob. Stryker already uses `test/**/*.ts`
// so its config is unchanged.
module.exports = {
  require: ['tsx/cjs'],
  extension: ['ts'],
  spec: ['test/*.ts', 'test/integration/*.ts']
}
