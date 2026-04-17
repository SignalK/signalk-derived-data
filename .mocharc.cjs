// Mocha's default spec glob (`test/*.js`) does not recurse into
// subdirectories. The per-calc split keeps unit tests at the top of
// `test/` and groups the integration tests under `test/integration/`,
// so we need an explicit glob. Stryker already uses `test/**/*.js`
// so its config is unchanged.
module.exports = {
  spec: ['test/*.js', 'test/integration/*.js']
}
