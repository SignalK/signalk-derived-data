const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const chai = require('chai')
chai.Should()
chai.use(require('chai-json-equal'))
const expect = require('chai').expect
const {
  isCompassAngle,
  isPosition,
  formatCompassAngle,
  degreesToRadians
} = require('../utils')

let selfData = {}

const app = {
  debug: () => {},
  getSelfPath: (path) => _.get(selfData, path)
}

const plugin = {
  batteries: ['0', '1'],
  engines: ['port'],
  tanks: ['fuel'],
  air: ['outside']
}

function load_calcs() {
  fpath = path.join(__dirname, '../calcs')
  files = fs.readdirSync(fpath)
  return files
    .map((fname) => {
      pgn = path.basename(fname, '.js')
      return require(path.join(fpath, pgn))(app, plugin)
    })
    .filter((calc) => {
      return typeof calc !== 'undefined'
    })
}

describe('Test Utility functions', function () {
  it(`isCompassAngle(Math.PI)`, (done) => {
    const n = isCompassAngle(Math.PI)
    n.should.equal(true)
    done()
  })
  it(`isCompassAngle(0)`, (done) => {
    const n = isCompassAngle(0)
    n.should.equal(true)
    done()
  })
  it(`isCompassAngle(-1)`, (done) => {
    const n = isCompassAngle(-1)
    n.should.equal(false)
    done()
  })
  it(`isCompassAngle(10)`, (done) => {
    const n = isCompassAngle(10)
    n.should.equal(false)
    done()
  })

  it(`isPosition({latitude: -10, longitude: 12})`, (done) => {
    const n = isPosition({ latitude: -10, longitude: 12 })
    n.should.equal(true)
    done()
  })
  it(`isPosition({latitude: 10, longitude: -12})`, (done) => {
    const n = isPosition({ latitude: 10, longitude: -12 })
    n.should.equal(true)
    done()
  })
  it(`isPosition({latitude: -100, longitude: 12})`, (done) => {
    const n = isPosition({ latitude: -100, longitude: 12 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: -10, longitude: 182})`, (done) => {
    const n = isPosition({ latitude: -100, longitude: 182 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: null, longitude: 182})`, (done) => {
    const n = isPosition({ latitude: null, longitude: 182 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: -10, longitude: null})`, (done) => {
    const n = isPosition({ latitude: -10, longitude: null })
    n.should.equal(false)
    done()
  })
  it(`isPosition(null)`, (done) => {
    const n = isPosition(null)
    n.should.equal(false)
    done()
  })
  it(`isPosition(undefined)`, (done) => {
    const n = isPosition(undefined)
    n.should.equal(false)
    done()
  })

  it(`formatCompassAngle(2.13)`, (done) => {
    const n = formatCompassAngle(2.13)
    n.should.equal(2.13)
    done()
  })
  it(`formatCompassAngle(375)`, (done) => {
    const n = formatCompassAngle(degreesToRadians(375)).toFixed(4)
    n.should.equal(degreesToRadians(15).toFixed(4))
    done()
  })
  it(`formatCompassAngle(-10)`, (done) => {
    const n = formatCompassAngle(degreesToRadians(-10)).toFixed(4)
    n.should.equal(degreesToRadians(350).toFixed(4))
    done()
  })
  it(`formatCompassAngle(abc)`, (done) => {
    const n = formatCompassAngle('abc')
    expect(n).to.equal(null)
    done()
  })
})

describe('calcs/magneticVariation', function () {
  // Loaded fresh so the module-level state (if any) starts clean.
  const calc = require('../calcs/magneticVariation')(app, plugin)

  it('emits both magneticVariation and its source path', done => {
    const res = calc.calculator({
      latitude: 39.0631232,
      longitude: -76.4872768
    })
    res.should.be.an('array').with.lengthOf(2)
    res[0].path.should.equal('navigation.magneticVariation')
    res[0].value.should.be.a('number')
    res[0].value.should.be.closeTo(-0.1922, 0.01)
    res[1].path.should.equal('navigation.magneticVariation.source')
    res[1].value.should.be.a('string').and.match(/WMM\s*2025/)
    done()
  })

  it('returns the same value for repeated calls at the same position', done => {
    // WMM includes secular variation based on current time, so back-to-back
    // calls can differ at µs precision. Tolerance is far below anything that
    // matters for navigation (1e-9 rad is roughly 2 microdegrees).
    const pos = { latitude: 52.52, longitude: 13.405 }
    const a = calc.calculator(pos)
    const b = calc.calculator(pos)
    a[0].value.should.be.closeTo(b[0].value, 1e-9)
    a[1].value.should.equal(b[1].value)
    done()
  })

  it('returns different values for distant positions', done => {
    const berlin = calc.calculator({ latitude: 52.52, longitude: 13.405 })
    const sydney = calc.calculator({ latitude: -33.8688, longitude: 151.2093 })
    berlin[0].value.should.not.equal(sydney[0].value)
    done()
  })

  it('returns undefined for a null-latitude position', done => {
    const res = calc.calculator({ latitude: null, longitude: 10 })
    ;(typeof res).should.equal('undefined')
    done()
  })

  it('returns undefined for a null-longitude position', done => {
    const res = calc.calculator({ latitude: 10, longitude: null })
    ;(typeof res).should.equal('undefined')
    done()
  })

  it('returns undefined for an undefined position', done => {
    const res = calc.calculator(undefined)
    ;(typeof res).should.equal('undefined')
    done()
  })

  it('declines to emit for position at (0, 0) because the calc guards falsy lat/lon', done => {
    // Captures current behavior: calculator uses truthy checks on lat/lon,
    // so (0, 0) is treated as "no fix" and returns undefined. This is arguably
    // wrong but is intentional here to lock the behavior during the perf refactor.
    const res = calc.calculator({ latitude: 0, longitude: 0 })
    ;(typeof res).should.equal('undefined')
    done()
  })
})

describe('derived data converts', function () {
  let calcs = load_calcs()

  calcs.forEach((calci) => {
    ;(_.isArray(calci) ? calci : [calci]).forEach((calc) => {
      if (calc.tests) {
        calc.tests.forEach((test, idx) => {
          it(`${calc.title}[${idx}] works`, (done) => {
            selfData = test.selfData || {}
            let res = calc.calculator.apply(null, test.input)
            if (test.expected) {
              res.should.jsonEqual(test.expected)
            } else if (test.expectedRange) {
              res[0].value.should.closeTo(
                test.expectedRange[0].value,
                test.expectedRange[0].delta
              )
            } else {
              ;(typeof res).should.equal('undefined')
            }
            done()
          })
        })
      }
    })
  })
})
