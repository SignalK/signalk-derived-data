import * as chai from 'chai'
import {
  describeStatus,
  discoverInstances,
  hasForeignSource,
  resolveMode,
  selectCalculations
} from '../src/auto'
import type { DataModel } from '../src/auto'
import type { Calculation } from '../src/types'
import { getPath } from './helpers'
chai.should()

function calc(
  optionKey: string,
  derivedFrom: string[],
  outputs: string[] | undefined,
  extra: Partial<Calculation> = {}
): Calculation {
  return {
    group: 'g',
    optionKey,
    title: optionKey,
    derivedFrom,
    outputs,
    calculator: () => undefined,
    ...extra
  }
}

function model(foreign: string[], values: string[] = []): DataModel {
  const foreignSet = new Set(foreign)
  const valueSet = new Set([...foreign, ...values])
  return {
    hasForeignValue: (p) => foreignSet.has(p),
    hasValue: (p) => valueSet.has(p)
  }
}

function active(status: Map<string, { state: string }>): string[] {
  return [...status.entries()]
    .filter(([, s]) => s.state === 'active')
    .map(([key]) => key)
}

describe('auto mode: resolveMode', () => {
  it('runs a fresh install (no configuration) in auto mode', () => {
    resolveMode(undefined).should.equal('auto')
    resolveMode({}).should.equal('auto')
  })

  it('keeps a saved configuration without mode in manual mode', () => {
    resolveMode({ heading: { heading: true } }).should.equal('manual')
  })

  it('honours an explicit mode', () => {
    resolveMode({ mode: 'auto', default_ttl: 0 }).should.equal('auto')
    resolveMode({ mode: 'manual' }).should.equal('manual')
  })
})

describe('auto mode: selectCalculations', () => {
  const variation = calc(
    'magneticVariation',
    ['navigation.position'],
    ['navigation.magneticVariation']
  )
  const heading = calc(
    'heading',
    ['navigation.headingMagnetic', 'navigation.magneticVariation'],
    ['navigation.headingTrue']
  )
  const leewayAngle = calc(
    'leewayAngle',
    ['navigation.headingTrue', 'navigation.courseOverGroundTrue'],
    ['navigation.leewayAngle']
  )

  it('follows chains through calculations it has chosen', () => {
    const status = selectCalculations(
      [leewayAngle, heading, variation],
      model([
        'navigation.position',
        'navigation.headingMagnetic',
        'navigation.courseOverGroundTrue'
      ])
    )
    active(status).should.have.members([
      'g/magneticVariation',
      'g/heading',
      'g/leewayAngle'
    ])
  })

  it('reports the inputs a calculation waits for', () => {
    const status = selectCalculations(
      [heading],
      model(['navigation.headingMagnetic'])
    )
    status.get('g/heading')!.should.deep.equal({
      state: 'waiting',
      missing: ['navigation.magneticVariation']
    })
  })

  it('leaves a path alone that another source already provides', () => {
    const status = selectCalculations(
      [heading],
      model([
        'navigation.headingMagnetic',
        'navigation.magneticVariation',
        'navigation.headingTrue'
      ])
    )
    status.get('g/heading')!.should.deep.equal({
      state: 'fromSensor',
      paths: ['navigation.headingTrue']
    })
  })

  it('never starts two calculations that only feed each other', () => {
    const belowKeel = calc(
      'belowKeel',
      ['environment.depth.belowSurface'],
      ['environment.depth.belowKeel']
    )
    const belowSurface = calc(
      'belowSurface',
      ['environment.depth.belowKeel'],
      ['environment.depth.belowSurface']
    )
    const status = selectCalculations([belowKeel, belowSurface], model([]))
    active(status).should.deep.equal([])
  })

  it('computes the other depth when a sensor provides one', () => {
    const belowKeel = calc(
      'belowKeel',
      ['environment.depth.belowSurface'],
      ['environment.depth.belowKeel']
    )
    const belowSurface = calc(
      'belowSurface',
      ['environment.depth.belowKeel'],
      ['environment.depth.belowSurface']
    )
    const status = selectCalculations(
      [belowKeel, belowSurface],
      model(['environment.depth.belowSurface'])
    )
    active(status).should.deep.equal(['g/belowKeel'])
    status.get('g/belowSurface')!.state.should.equal('fromSensor')
  })

  it('gives each output a single producer, preferring the earlier one', () => {
    const a = calc('vmgA', ['x'], ['performance.velocityMadeGood'])
    const b = calc('vmgB', ['x'], ['performance.velocityMadeGood'])
    const status = selectCalculations([a, b], model(['x']))
    active(status).should.deep.equal(['g/vmgA'])
    status.get('g/vmgB')!.should.deep.equal({
      state: 'fromCalculation',
      paths: ['performance.velocityMadeGood']
    })
  })

  it('waits for the vessel data a calculation requires', () => {
    const belowKeel = calc(
      'belowKeel',
      ['environment.depth.belowSurface'],
      ['environment.depth.belowKeel'],
      { requires: ['design.draft.value.maximum'] }
    )
    const without = selectCalculations(
      [belowKeel],
      model(['environment.depth.belowSurface'])
    )
    without.get('g/belowKeel')!.should.deep.equal({
      state: 'waiting',
      missing: ['design.draft.value.maximum']
    })
    const withDraft = selectCalculations(
      [belowKeel],
      model(['environment.depth.belowSurface'], ['design.draft.value.maximum'])
    )
    active(withDraft).should.deep.equal(['g/belowKeel'])
  })

  it('excludes calculations marked auto: false, deprecated or without outputs', () => {
    const status = selectCalculations(
      [
        calc('windShift', ['x'], ['notifications.windShift'], {
          auto: false
        }),
        calc('old', ['x'], ['y'], { title: 'DEPRECATED (use z)' }),
        calc('noOutputs', ['x'], undefined)
      ],
      model(['x'])
    )
    ;[...status.values()]
      .map((s) => s.state)
      .should.deep.equal(['excluded', 'excluded', 'excluded'])
  })
})

describe('auto mode: describeStatus', () => {
  it('explains each state', () => {
    describeStatus({ state: 'active' }).should.equal('auto: active')
    describeStatus({ state: 'waiting', missing: ['a', 'b'] }).should.equal(
      'auto: waiting for a, b'
    )
    describeStatus({ state: 'fromSensor', paths: ['a'] }).should.contain(
      'a already comes from another source'
    )
    describeStatus({ state: 'fromCalculation', paths: ['a'] }).should.contain(
      'a already comes from another calculation'
    )
    describeStatus({ state: 'excluded' }).should.equal(
      'auto: never enabled automatically'
    )
  })
})

describe('auto mode: discoverInstances', () => {
  it('reads engines, batteries and tanks from the data model', () => {
    const self = {
      propulsion: {
        port: { revolutions: { value: 10, $source: 'n2k' } },
        starboard: { revolutions: { value: 12, $source: 'n2k' } }
      },
      electrical: {
        batteries: { house: { voltage: { value: 12.6, $source: 'n2k' } } }
      },
      tanks: {
        fuel: { 0: { currentLevel: { value: 0.5, $source: 'n2k' } } },
        freshWater: { bow: { currentLevel: { value: 0.8, $source: 'n2k' } } }
      }
    }
    discoverInstances((p) => getPath(self, p)).should.deep.equal({
      engines: ['port', 'starboard'],
      batteries: ['house'],
      tanks: ['fuel.0', 'freshWater.bow']
    })
  })

  it('returns empty lists on a boat without them', () => {
    discoverInstances(() => undefined).should.deep.equal({
      engines: [],
      batteries: [],
      tanks: []
    })
  })
})

describe('auto mode: hasForeignSource', () => {
  it('reads the source of a leaf', () => {
    hasForeignSource(
      { value: 1, $source: 'n2k.1' },
      'derived-data'
    ).should.equal(true)
    hasForeignSource(
      { value: 1, $source: 'derived-data' },
      'derived-data'
    ).should.equal(false)
    hasForeignSource(undefined, 'derived-data').should.equal(false)
  })

  it('sees another source next to its own', () => {
    hasForeignSource(
      {
        value: 1,
        $source: 'derived-data',
        values: { 'derived-data': { value: 1 }, 'n2k.1': { value: 1 } }
      },
      'derived-data'
    ).should.equal(true)
  })

  it('looks below a branch', () => {
    const moon = {
      phase: { value: 0.5, $source: 'derived-data' },
      times: { rise: { value: 'x', $source: 'derived-data' } }
    }
    hasForeignSource(moon, 'derived-data').should.equal(false)
    moon.times.rise.$source = 'astro-plugin'
    hasForeignSource(moon, 'derived-data').should.equal(true)
  })
})
