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
})
