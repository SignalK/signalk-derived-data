const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('magneticVariation', () => {
  const calc = require('../calcs/magneticVariation')

  it('emits a source field reflecting the WMM model name', () => {
    const d = calc(makeApp(), makePlugin())
    const out = d.calculator({ latitude: 39.06, longitude: -76.48 })
    const src = out.find(
      (x) => x.path === 'navigation.magneticVariation.source'
    )
    src.should.exist
    src.value.should.be.a('string')
    src.value.should.not.include('-') // spaces instead of dashes
  })

  // Covers the `(model.name || 'WMM-2025')` fallback branch. Real
  // geomagnetism always returns a named model, so we stub it in
  // require.cache, force-reload magneticVariation, and inspect the
  // source value before restoring the real module.
  it('falls back to "WMM 2025" when the loaded model has no name', () => {
    const geomagnetismPath = require.resolve('geomagnetism')
    const magvarPath = require.resolve('../calcs/magneticVariation')
    const realGeo = require.cache[geomagnetismPath]
    const realMagvar = require.cache[magvarPath]
    try {
      require.cache[geomagnetismPath] = {
        id: geomagnetismPath,
        filename: geomagnetismPath,
        loaded: true,
        exports: {
          model: () => ({ point: () => ({ decl: 0 }) })
        }
      }
      delete require.cache[magvarPath]
      const freshCalc = require('../calcs/magneticVariation')
      const d = freshCalc(makeApp(), makePlugin())
      const out = d.calculator({ latitude: 0, longitude: 0 })
      const src = out.find(
        (x) => x.path === 'navigation.magneticVariation.source'
      )
      src.value.should.equal('WMM 2025')
    } finally {
      if (realGeo) require.cache[geomagnetismPath] = realGeo
      else delete require.cache[geomagnetismPath]
      if (realMagvar) require.cache[magvarPath] = realMagvar
      else delete require.cache[magvarPath]
    }
  })
})
