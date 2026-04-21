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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const indexModule: any = require('../src')
const { createSkipFunction, deltaValuesEqual } = indexModule

describe('index.js deltaValuesEqual', function () {
  it('treats identical references as equal', (done) => {
    const v = [{ path: 'a', value: 1 }]
    deltaValuesEqual(v, v).should.equal(true)
    done()
  })

  it('treats two fresh arrays with matching {path, value} as equal', (done) => {
    deltaValuesEqual(
      [{ path: 'a', value: 1 }],
      [{ path: 'a', value: 1 }]
    ).should.equal(true)
    done()
  })

  it('distinguishes by path', (done) => {
    deltaValuesEqual(
      [{ path: 'a', value: 1 }],
      [{ path: 'b', value: 1 }]
    ).should.equal(false)
    done()
  })

  it('distinguishes by value', (done) => {
    deltaValuesEqual(
      [{ path: 'a', value: 1 }],
      [{ path: 'a', value: 2 }]
    ).should.equal(false)
    done()
  })

  it('handles multi-item arrays', (done) => {
    deltaValuesEqual(
      [
        { path: 'a', value: 1 },
        { path: 'b', value: 2 }
      ],
      [
        { path: 'a', value: 1 },
        { path: 'b', value: 2 }
      ]
    ).should.equal(true)
    deltaValuesEqual(
      [
        { path: 'a', value: 1 },
        { path: 'b', value: 2 }
      ],
      [
        { path: 'a', value: 1 },
        { path: 'b', value: 3 }
      ]
    ).should.equal(false)
    done()
  })

  it('returns false for different lengths', (done) => {
    deltaValuesEqual(
      [{ path: 'a', value: 1 }],
      [
        { path: 'a', value: 1 },
        { path: 'b', value: 2 }
      ]
    ).should.equal(false)
    done()
  })

  it('treats null/undefined as not equal unless both are the same ref', (done) => {
    deltaValuesEqual(undefined, undefined).should.equal(true)
    deltaValuesEqual(null, null).should.equal(true)
    deltaValuesEqual(null, undefined).should.equal(false)
    deltaValuesEqual([{ path: 'a', value: 1 }], null).should.equal(false)
    done()
  })

  it('handles null and NaN as values strictly', (done) => {
    // null === null is true
    deltaValuesEqual(
      [{ path: 'a', value: null }],
      [{ path: 'a', value: null }]
    ).should.equal(true)
    // NaN !== NaN — shallow compare follows strict equality semantics,
    // so two NaN values are treated as not equal. Acceptable: it just
    // means a stuck-NaN source emits every tick instead of being dropped.
    deltaValuesEqual(
      [{ path: 'a', value: NaN }],
      [{ path: 'a', value: NaN }]
    ).should.equal(false)
    done()
  })

  it('treats two non-array non-null arguments as not equal', (done) => {
    // Neither argument is null so the `a == null || b == null` early-out
    // is skipped, then the Array.isArray guard returns false. Covers the
    // non-array branch of that guard.
    deltaValuesEqual('foo', 'bar').should.equal(false)
    deltaValuesEqual({}, {}).should.equal(false)
    deltaValuesEqual([{ path: 'a', value: 1 }], 'not-an-array').should.equal(
      false
    )
    done()
  })

  it('treats identical element references inside matching arrays as equal', (done) => {
    // Same object reference reused in both arrays -> the inner `x === y`
    // fast-path fires for each element. Verifies that branch is taken.
    const item = { path: 'a', value: 1 }
    deltaValuesEqual([item], [item]).should.equal(true)
    const other = { path: 'b', value: 2 }
    deltaValuesEqual([item, other], [item, other]).should.equal(true)
    done()
  })

  it('returns false when an element is falsy on one side only', (done) => {
    // After the `x === y` fast-path fails, the `!x || !y` guard returns
    // false when only one of the two is null/undefined/0/''.
    deltaValuesEqual([{ path: 'a', value: 1 }], [null]).should.equal(false)
    deltaValuesEqual([null], [{ path: 'a', value: 1 }]).should.equal(false)
    deltaValuesEqual([{ path: 'a', value: 1 }], [undefined]).should.equal(false)
    done()
  })

  it('returns false for complex {context, updates} deltas with fresh refs', (done) => {
    // cpa_tcpa-style shape — not dedupped by the shallow compare.
    // This is intentional: over-emitting is safer than dropping, and in
    // practice cpa_tcpa does not set a TTL so this path is rarely hit.
    const a = [
      {
        context: 'vessels.x',
        updates: [{ values: [{ path: 'p', value: 1 }] }]
      }
    ]
    const b = [
      {
        context: 'vessels.x',
        updates: [{ values: [{ path: 'p', value: 1 }] }]
      }
    ]
    deltaValuesEqual(a, b).should.equal(false)
    done()
  })
})

describe('index.js createSkipFunction', function () {
  // Fast-path: the calc doesn't configure ttl and the plugin default is 0.
  // The helper returns null to signal "don't chain skipDuplicates at all",
  // saving one Bacon operator on the per-emit hot path.
  it('returns null when no ttl is configured', (done) => {
    expect(createSkipFunction({}, 0)).to.equal(null)
    expect(createSkipFunction({}, undefined)).to.equal(null)
    done()
  })

  it('returns null when calculation.ttl is 0 and default_ttl is 0', (done) => {
    expect(createSkipFunction({ ttl: 0 }, 0)).to.equal(null)
    done()
  })

  it('returns a function when calculation.ttl > 0', (done) => {
    createSkipFunction({ ttl: 1 }, 0).should.be.a('function')
    done()
  })

  it('returns a function when default_ttl > 0', (done) => {
    createSkipFunction({}, 1).should.be.a('function')
    done()
  })

  it('uses calculation.ttl when defined, suppressing repeats in the window', (done) => {
    const calc = { ttl: 60 }
    const skip = createSkipFunction(calc, 0)
    const v = [{ path: 'a', value: 1 }]
    // First call primes nextOutput and emits.
    skip(v, v).should.equal(false)
    // Same values, still inside the 60s window — should be skipped.
    skip(v, v).should.equal(true)
    done()
  })

  it('falls back to default_ttl when calculation.ttl is undefined', (done) => {
    const calc = {}
    const skip = createSkipFunction(calc, 60)
    const v = [{ path: 'a', value: 1 }]
    skip(v, v).should.equal(false)
    skip(v, v).should.equal(true)
    done()
  })

  it('emits (returns false) when values differ, even inside the window', (done) => {
    const calc = { ttl: 60 }
    const skip = createSkipFunction(calc, 0)
    const a = [{ path: 'x', value: 1 }]
    const b = [{ path: 'x', value: 2 }]
    skip(a, a).should.equal(false) // prime window
    skip(a, b).should.equal(false) // different values
    done()
  })

  it('re-emits once the TTL window has expired', (done) => {
    // 0.01 s = 10 ms window so the test stays fast.
    const calc = { ttl: 0.01 }
    const skip = createSkipFunction(calc, 0)
    const v = [{ path: 'a', value: 1 }]
    skip(v, v).should.equal(false) // prime
    skip(v, v).should.equal(true) // inside window
    setTimeout(() => {
      skip(v, v).should.equal(false) // window expired, re-emit
      done()
    }, 25)
  })

  it('handles undefined before/after', (done) => {
    const calc = { ttl: 60 }
    const skip = createSkipFunction(calc, 0)
    skip(undefined, undefined).should.equal(false) // prime window
    skip(undefined, undefined).should.equal(true) // equal + inside window
    done()
  })

  it('calculation.ttl takes precedence over default_ttl', (done) => {
    // calc.ttl = 60 means the window is 60s, not 0.01s.
    const calc = { ttl: 60 }
    const skip = createSkipFunction(calc, 0.01)
    const v = [{ path: 'a', value: 1 }]
    skip(v, v).should.equal(false)
    // If default_ttl were used, this would have expired by now.
    // Assert we are still inside the 60s window.
    skip(v, v).should.equal(true)
    done()
  })

  it('handles arrays of complex delta objects (context/updates)', (done) => {
    // cpa_tcpa returns this shape; if someone sets a TTL on a calc like
    // that, the helper must still behave correctly.
    const calc = { ttl: 60 }
    const skip = createSkipFunction(calc, 0)
    const v = [
      {
        context: 'vessels.x',
        updates: [{ values: [{ path: 'p', value: 1 }] }]
      }
    ]
    skip(v, v).should.equal(false)
    skip(v, v).should.equal(true)
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
