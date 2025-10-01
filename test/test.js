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
  getSelfPath: path => _.get(selfData, path)
}

const plugin = {
  batteries: ['0', '1'],
  engines: ['port'],
  tanks: ['fuel'],
  air: ['outside']
}

function load_calcs () {
  fpath = path.join(__dirname, '../calcs')
  files = fs.readdirSync(fpath)
  return files
    .map(fname => {
      pgn = path.basename(fname, '.js')
      return require(path.join(fpath, pgn))(app, plugin)
    })
    .filter(calc => {
      return typeof calc !== 'undefined'
    })
}

describe('Test Utility functions', function () {
  it(`isCompassAngle(Math.PI)`, done => {
    const n = isCompassAngle(Math.PI)
    n.should.equal(true)
    done()
  })
  it(`isCompassAngle(0)`, done => {
    const n = isCompassAngle(0)
    n.should.equal(true)
    done()
  })
  it(`isCompassAngle(-1)`, done => {
    const n = isCompassAngle(-1)
    n.should.equal(false)
    done()
  })
  it(`isCompassAngle(10)`, done => {
    const n = isCompassAngle(10)
    n.should.equal(false)
    done()
  })

  it(`isPosition({latitude: -10, longitude: 12})`, done => {
    const n = isPosition({ latitude: -10, longitude: 12 })
    n.should.equal(true)
    done()
  })
  it(`isPosition({latitude: 10, longitude: -12})`, done => {
    const n = isPosition({ latitude: 10, longitude: -12 })
    n.should.equal(true)
    done()
  })
  it(`isPosition({latitude: -100, longitude: 12})`, done => {
    const n = isPosition({ latitude: -100, longitude: 12 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: -10, longitude: 182})`, done => {
    const n = isPosition({ latitude: -100, longitude: 182 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: null, longitude: 182})`, done => {
    const n = isPosition({ latitude: null, longitude: 182 })
    n.should.equal(false)
    done()
  })
  it(`isPosition({latitude: -10, longitude: null})`, done => {
    const n = isPosition({ latitude: -10, longitude: null })
    n.should.equal(false)
    done()
  })
  it(`isPosition(null)`, done => {
    const n = isPosition(null)
    n.should.equal(false)
    done()
  })
  it(`isPosition(undefined)`, done => {
    const n = isPosition(undefined)
    n.should.equal(false)
    done()
  })

  it(`formatCompassAngle(2.13)`, done => {
    const n = formatCompassAngle(2.13)
    n.should.equal(2.13)
    done()
  })
  it(`formatCompassAngle(375)`, done => {
    const n = formatCompassAngle(degreesToRadians(375)).toFixed(4)
    n.should.equal(degreesToRadians(15).toFixed(4))
    done()
  })
  it(`formatCompassAngle(-10)`, done => {
    const n = formatCompassAngle(degreesToRadians(-10)).toFixed(4)
    n.should.equal(degreesToRadians(350).toFixed(4))
    done()
  })
  it(`formatCompassAngle(abc)`, done => {
    const n = formatCompassAngle('abc')
    expect(n).to.equal(null)
    done()
  })
})

describe('derived data converts', function () {
  let calcs = load_calcs()

  calcs.forEach(calci => {
    ;(_.isArray(calci) ? calci : [calci]).forEach(calc => {
      if (calc.tests) {
        calc.tests.forEach((test, idx) => {
          it(`${calc.title}[${idx}] works`, done => {
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
