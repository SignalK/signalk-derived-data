const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('heatIndex', () => {
  const calc = require('../calcs/heatIndex')

  const d = () => calc(makeApp(), makePlugin())

  it('applies the Rothfusz regression at 95°F, 70% RH', () => {
    const out = d().calculator(308.15, 0.7)
    out[0].path.should.equal('environment.outside.heatIndexTemperature')
    out[0].value.should.be.closeTo(323.4905780555556, 1e-9)
  })

  it('passes temp through unchanged below the 80°F threshold', () => {
    const out = d().calculator(290, 0.5) // ~62°F
    out[0].value.should.be.closeTo(290, 1e-9)
  })

  it('applies the high-humidity adjustment for 80-87°F and RH > 85%', () => {
    // 85°F, 90% RH -> triggers the `h > 85 && tempF <= 87` branch.
    const out = d().calculator((85 - 32) * 5 / 9 + 273.15, 0.9)
    out[0].value.should.be.closeTo(311.91711311111135, 1e-9)
  })

  it('applies the low-humidity adjustment for 80-112°F and RH < 13%', () => {
    // 100°F, 10% RH -> triggers the `h < 13 && tempF <= 112` branch.
    const out = d().calculator((100 - 32) * 5 / 9 + 273.15, 0.1)
    out[0].value.should.be.closeTo(307.6624903678819, 1e-9)
  })

  // tempF = 80, h = 40% gives a Rothfusz value just under 80°F, so the
  // `heatIndex < 80` branch kicks in and swaps to the simple Steadman
  // formula.
  it('falls back to Steadman when Rothfusz gives a value below 80°F', () => {
    const out = d().calculator(299.8167, 0.4) // ~80°F, 40% RH
    out[0].value.should.be.closeTo(299.58337, 1e-3)
  })
})
