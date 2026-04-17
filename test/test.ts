import * as path from 'path'
import * as fs from 'fs'
import * as chai from 'chai'
import { getPath } from './helpers'
chai.should()
// eslint-disable-next-line @typescript-eslint/no-require-imports
chai.use(require('chai-json-equal'))
const expect = chai.expect

import {
  isCompassAngle,
  isPosition,
  formatCompassAngle,
  degreesToRadians
} from '../src/utils'

let selfData: Record<string, unknown> = {}

const app: any = {
  debug: () => {},
  getSelfPath: (p: string) => getPath(selfData, p)
}

const plugin: any = {
  batteries: ['0', '1'],
  engines: ['port'],
  tanks: ['fuel'],
  air: ['outside']
}

function load_calcs(): any[] {
  const fpath = path.join(__dirname, '../src/calcs')
  const files = fs.readdirSync(fpath)
  return files
    .map((fname) => {
      const pgn = path.basename(fname, path.extname(fname))
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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
    n!.should.equal(2.13)
    done()
  })
  it(`formatCompassAngle(375)`, (done) => {
    const n = formatCompassAngle(degreesToRadians(375))!.toFixed(4)
    n.should.equal(degreesToRadians(15).toFixed(4))
    done()
  })
  it(`formatCompassAngle(-10)`, (done) => {
    const n = formatCompassAngle(degreesToRadians(-10))!.toFixed(4)
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc = require('../src/calcs/magneticVariation')(app, plugin)

  it('emits both magneticVariation and its source path', (done) => {
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

  it('returns bit-exact the same value for repeated calls in the same cell', (done) => {
    // The coarse-cell cache means two calls within the same ~0.1° cell return
    // the identical cached number, so strict equality holds. Without the cache,
    // WMM's time-based secular variation makes back-to-back calls drift by
    // ~1e-15 rad. Strict equality here is the observable proof that the cache
    // path is taken.
    const a = calc.calculator({ latitude: 52.52, longitude: 13.405 })
    const b = calc.calculator({ latitude: 52.521, longitude: 13.4055 })
    a[0].value.should.equal(b[0].value)
    a[1].value.should.equal(b[1].value)
    done()
  })

  it('recomputes when position crosses a cache cell boundary', (done) => {
    // Two positions far enough apart (>0.1°) fall into different cells, so
    // the cache must miss and the second call must return a different value.
    const a = calc.calculator({ latitude: 52.52, longitude: 13.405 })
    const b = calc.calculator({ latitude: 52.9, longitude: 13.8 })
    a[0].value.should.not.equal(b[0].value)
    done()
  })

  it('returns different values for distant positions', (done) => {
    const berlin = calc.calculator({ latitude: 52.52, longitude: 13.405 })
    const sydney = calc.calculator({ latitude: -33.8688, longitude: 151.2093 })
    berlin[0].value.should.not.equal(sydney[0].value)
    done()
  })

  it('returns undefined for a null-latitude position', (done) => {
    const res = calc.calculator({ latitude: null, longitude: 10 })
    ;(typeof res).should.equal('undefined')
    done()
  })

  it('returns undefined for a null-longitude position', (done) => {
    const res = calc.calculator({ latitude: 10, longitude: null })
    ;(typeof res).should.equal('undefined')
    done()
  })

  it('returns undefined for an undefined position', (done) => {
    const res = calc.calculator(undefined)
    ;(typeof res).should.equal('undefined')
    done()
  })

  // Covers the `(model.name || 'WMM-2025')` fallback branch. Real
  // geomagnetism always returns a named model, so we stub the module in
  // require.cache, force-reload magneticVariation, and inspect the
  // emitted source value before restoring the real module.
  it('falls back to "WMM 2025" when the loaded model has no name', (done) => {
    const geomagnetismPath = require.resolve('geomagnetism')
    const magvarPath = require.resolve('../src/calcs/magneticVariation')
    const realGeo = require.cache[geomagnetismPath]
    const realMagvar = require.cache[magvarPath]
    try {
      require.cache[geomagnetismPath] = {
        id: geomagnetismPath,
        filename: geomagnetismPath,
        loaded: true,
        exports: {
          // No `name` property so `model.name || 'WMM-2025'` takes the
          // fallback branch.
          model: () => ({ point: () => ({ decl: 0 }) })
        }
      } as NodeJS.Module
      delete require.cache[magvarPath]
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const freshCalc = require('../src/calcs/magneticVariation')(app, plugin)
      const res = freshCalc.calculator({ latitude: 0, longitude: 0 })
      res[1].path.should.equal('navigation.magneticVariation.source')
      res[1].value.should.equal('WMM 2025')
    } finally {
      if (realGeo) require.cache[geomagnetismPath] = realGeo
      else delete require.cache[geomagnetismPath]
      if (realMagvar) require.cache[magvarPath] = realMagvar
      else delete require.cache[magvarPath]
    }
    done()
  })
})

describe('derived data converts', function () {
  const calcs = load_calcs()

  calcs.forEach((calci: any) => {
    ;(Array.isArray(calci) ? calci : [calci]).forEach((calc: any) => {
      if (calc.tests) {
        calc.tests.forEach((test: any, idx: number) => {
          it(`${calc.title}[${idx}] works`, (done) => {
            selfData = test.selfData || {}
            const res = calc.calculator.apply(null, test.input)
            if (test.expected) {
              ;(res as any).should.jsonEqual(test.expected)
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
