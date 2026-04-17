const chai = require('chai')
chai.Should()
const expect = chai.expect

describe('utils.js — extra branches', () => {
  const {
    formatCompassAngle,
    isCompassAngle,
    isPosition,
    degreesToRadians,
    radiansToDegrees
  } = require('../utils')

  it('returns null for Infinity (non-numeric guard)', () => {
    expect(formatCompassAngle(Infinity)).to.equal(null)
  })

  it('returns null for NaN (non-numeric guard)', () => {
    expect(formatCompassAngle(NaN)).to.equal(null)
  })

  it('returns the value unchanged when already in [0, 2*PI)', () => {
    formatCompassAngle(1.23).should.equal(1.23)
  })

  it('isCompassAngle returns false for non-numeric input', () => {
    isCompassAngle('abc').should.equal(false)
    isCompassAngle(null).should.equal(false)
    isCompassAngle(undefined).should.equal(false)
    isCompassAngle(NaN).should.equal(false)
    isCompassAngle(Infinity).should.equal(false)
  })

  it('isPosition accepts exact latitude/longitude boundaries', () => {
    isPosition({ latitude: -90, longitude: -180 }).should.equal(true)
    isPosition({ latitude: 90, longitude: 180 }).should.equal(true)
    isPosition({ latitude: 0, longitude: 0 }).should.equal(true)
  })

  it('isPosition rejects values just outside the boundaries', () => {
    isPosition({ latitude: -90.0001, longitude: 0 }).should.equal(false)
    isPosition({ latitude: 90.0001, longitude: 0 }).should.equal(false)
    isPosition({ latitude: 0, longitude: -180.0001 }).should.equal(false)
    isPosition({ latitude: 0, longitude: 180.0001 }).should.equal(false)
  })

  it('degreesToRadians converts correctly', () => {
    degreesToRadians(180).should.be.closeTo(Math.PI, 1e-9)
    degreesToRadians(0).should.equal(0)
    degreesToRadians(90).should.be.closeTo(Math.PI / 2, 1e-9)
  })

  it('radiansToDegrees converts correctly', () => {
    radiansToDegrees(Math.PI).should.be.closeTo(180, 1e-9)
    radiansToDegrees(0).should.equal(0)
    radiansToDegrees(Math.PI / 2).should.be.closeTo(90, 1e-9)
  })

  it('formatCompassAngle folds values above 2*PI back into [0, 2*PI)', () => {
    formatCompassAngle(2 * Math.PI + 0.1).should.be.closeTo(0.1, 1e-9)
  })

  it('formatCompassAngle folds negative values into [0, 2*PI)', () => {
    formatCompassAngle(-0.1).should.be.closeTo(2 * Math.PI - 0.1, 1e-9)
  })

  it('isCompassAngle accepts the lower bound 0 and rejects 2*PI', () => {
    isCompassAngle(0).should.equal(true)
    // 2*PI is at the upper bound; the spec calls for < 2*PI.
    isCompassAngle(2 * Math.PI).should.equal(false)
  })

  it('formatCompassAngle returns 0 unchanged', () => {
    // Distinguishes the exact boundary at 0 from the `< 0` branch.
    formatCompassAngle(0).should.equal(0)
  })

  it('formatCompassAngle folds exactly 2*PI down to 0', () => {
    // Distinguishes the `>= 2*PI` branch from `> 2*PI` at the boundary.
    formatCompassAngle(2 * Math.PI).should.be.closeTo(0, 1e-9)
  })
})
