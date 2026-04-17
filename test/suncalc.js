const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('suncalc (night fallback)', () => {
  const calc = require('../calcs/suncalc')

  it('returns "night" when now is before nauticalDawn', () => {
    const d = calc(makeApp(), makePlugin())
    // Summer solstice, equator: nauticalDawn ~05:10Z. 02:00Z is earlier.
    const out = d.calculator('2024-06-21T02:00:00Z', {
      latitude: 0,
      longitude: 0
    })
    out.should.deep.equal([
      { path: 'environment.sun', value: 'night' },
      { path: 'environment.mode', value: 'night' }
    ])
  })

  it('uses the current time when datetime is empty and position is valid', () => {
    const d = calc(makeApp(), makePlugin())
    // Valid position, empty datetime -> `new Date()` path is taken. The
    // assertion only checks the shape; the exact value depends on the
    // current clock.
    const out = d.calculator('', { latitude: 0, longitude: 0 })
    out.should.be.an('array').with.lengthOf(2)
    out[0].path.should.equal('environment.sun')
  })
})
