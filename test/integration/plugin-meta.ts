// Tests for Calculation.meta: what each calc declares, and the single meta
// delta plugin.start() sends for the enabled calculations.

import * as fs from 'fs'
import * as path from 'path'
import * as chai from 'chai'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Bacon: any = require('baconjs')
import { getMetadata } from '@signalk/path-metadata'
import { makeApp, makePlugin } from '../helpers'
chai.should()

const calcsDir = path.join(__dirname, '../../src/calcs')

function loadCalcs(app: any, plugin: any): Record<string, any[]> {
  const calcs: Record<string, any[]> = {}
  for (const file of fs.readdirSync(calcsDir)) {
    if (!file.endsWith('.ts') || file.startsWith('__test_')) continue
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const factory = require(path.join(calcsDir, file))
    calcs[file.replace(/\.ts$/, '')] = ([] as any[])
      .concat(factory(app, plugin))
      .filter(Boolean)
  }
  return calcs
}

function startPlugin(props: any): any[] {
  const handled: any[] = []
  const app: any = makeApp({
    handleMessage: (_id, delta) => handled.push(delta)
  })
  app.streambundle = { getSelfStream: () => new Bacon.Bus() }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const plugin = require('../../src')(app)
  plugin.start({ traffic: { notificationZones: [] }, ...props })
  plugin.stop()
  return handled.filter((delta) => delta.updates?.some((u: any) => u.meta))
}

// Inputs that make each calculation with meta write its paths.
const position = { latitude: 45.5, longitude: -73.5 }
const writingInputs: Record<string, unknown[][]> = {
  batteryPower: [[12.5, 4]],
  eta: [['2024-06-21T12:00:00Z', 1000, 2]],
  fuelConsumption: [[0.0001, 3]],
  magneticVariation: [[position]],
  moon: [['2024-06-21T12:00:00Z', position]],
  propslip: [[30, 3]],
  setDrift: [[0, 1.57, 2, 3, 0.1]],
  steer_error: [[0.5, 0.2]],
  suncalc: [['2024-06-21T12:00:00Z', position]],
  suntime: [['2024-06-21T12:00:00Z', position]],
  windGround: [
    [0.5, 3, 5, 0.4],
    [0.5, 0.3]
  ]
}

describe('Calculation.meta', () => {
  const app = makeApp({
    selfPaths: {
      propulsion: {
        port: {
          transmission: { gearRatio: { value: 2 } },
          drive: { propeller: { pitch: { value: 0.5 } } }
        }
      }
    }
  })
  const calcs = loadCalcs(app, makePlugin())

  it('describes only paths outside the Signal K specification', () => {
    // A path the specification defines already gets its description and
    // units from the server's path metadata, and meta sent by a plugin
    // would override it: such paths must not appear in Calculation.meta.
    const specPaths = Object.values(calcs)
      .flat()
      .flatMap((calc) => Object.keys(calc.meta ?? {}))
      .filter((metaPath) => getMetadata('vessels.self.' + metaPath))
    specPaths.should.deep.equal(
      [],
      "the Signal K specification defines these paths; the server's path metadata describes them"
    )
  })

  it('describes only paths its calculation writes', () => {
    for (const [name, list] of Object.entries(calcs)) {
      list.forEach((calc, index) => {
        const metaPaths = Object.keys(calc.meta ?? {})
        if (metaPaths.length === 0) return
        // One entry per calculation, or one for all instances (batteries)
        const inputs = writingInputs[name]?.[index] ?? writingInputs[name]?.[0]
        chai.expect(inputs, `writing inputs for ${name}[${index}]`).to.exist
        const written = ([] as any[])
          .concat(calc.calculator(...inputs!) ?? [])
          .map((value) => value.path)
        written.should.include.members(metaPaths, `${name}[${index}]`)
      })
    }
  })

  it('gives every path a description, and units from a known list', () => {
    const units = new Set([
      'W',
      'ratio',
      'rad',
      'm/s',
      'm/m3',
      'RFC 3339 (UTC)'
    ])
    for (const calc of Object.values(calcs).flat()) {
      for (const meta of Object.values(calc.meta ?? {}) as any[]) {
        meta.description.should.be.a('string').and.not.equal('')
        if (meta.units !== undefined) units.has(meta.units).should.equal(true)
      }
    }
  })
})

describe('plugin.start() meta delta', () => {
  it('sends one meta delta for the enabled calculations only', () => {
    const deltas = startPlugin({
      battery_instances: '0, 1',
      electrical: { batterPower0: true },
      sun: { Sun: true, forecastDays: 0 }
    })
    deltas.should.have.lengthOf(1)
    deltas[0].context.should.equal('vessels.test')
    const metaPaths = deltas[0].updates[0].meta.map((m: any) => m.path)
    metaPaths.should.have.members([
      'electrical.batteries.0.power',
      'environment.sun'
    ])
    deltas[0].updates[0].meta[0].value.should.have.property('description')
  })

  it('describes each forecast day of an enabled forecast', () => {
    const deltas = startPlugin({ moon: { Moon: true, forecastDays: 2 } })
    const metaPaths = deltas[0].updates[0].meta.map((m: any) => m.path)
    metaPaths.should.include.members([
      'environment.moon.fraction',
      'environment.moon.1.fraction',
      'environment.moon.2.fraction'
    ])
    metaPaths.should.not.include('environment.moon.3.fraction')
  })

  it('sends no meta when no enabled calculation has meta', () => {
    startPlugin({ depth: { belowKeel: true } }).should.have.lengthOf(0)
  })
})
