import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('propslip', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/propslip')

  it('returns undefined when revolutions are zero', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 1 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(0, 1)).to.equal(undefined)
  })

  it('computes slip = 1 - stw*gearRatio/(revs*pitch)', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 2 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    const out = arr[0].calculator(4, 1)
    out[0].value.should.be.closeTo(0.5, 1e-9)
  })

  it('returns undefined when gearRatio is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { drive: { propeller: { pitch: { value: 1 } } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(2, 1)).to.equal(undefined)
  })

  it('returns undefined when pitch is missing', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: { transmission: { gearRatio: { value: 1 } } }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(2, 1)).to.equal(undefined)
  })

  it('returns undefined when speedThroughWater is not finite', () => {
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 1 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const arr = calc(app, makePlugin())
    expect(arr[0].calculator(2, null)).to.equal(undefined)
    expect(arr[0].calculator(2, undefined)).to.equal(undefined)
  })

  it('reads gearRatio and pitch once and reuses them on subsequent calls', () => {
    // Once the config is cached, the inner loop no longer issues
    // getSelfPath calls for gearRatio/pitch — they're drivetrain design
    // numbers and don't change at runtime.
    let lookups = 0
    const app = makeApp({
      selfPaths: {
        propulsion: {
          port: {
            transmission: { gearRatio: { value: 2 } },
            drive: { propeller: { pitch: { value: 1 } } }
          }
        }
      }
    })
    const realGetSelfPath = app.getSelfPath
    app.getSelfPath = (p: string) => {
      lookups += 1
      return realGetSelfPath(p)
    }
    const arr = calc(app, makePlugin())
    arr[0].calculator(4, 1)
    arr[0].calculator(5, 1)
    arr[0].calculator(6, 1)
    // 2 lookups total: gearRatio and pitch, each fetched once on the
    // first call. Subsequent calls hit the closure cache.
    lookups.should.equal(2)
  })
})
