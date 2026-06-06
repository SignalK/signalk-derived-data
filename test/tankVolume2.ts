import * as chai from 'chai'
chai.should()
const expect = chai.expect

import { makeApp, makePlugin } from './helpers'

describe('tankVolume2', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/tankVolume2')

  it('exposes derivedFrom and title for the configured tank', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(1)
    arr[0]
      .derivedFrom()
      .should.deep.equal(['tanks.fuel.0.currentLevel', 'tanks.fuel.0.capacity'])
    arr[0].optionKey.should.equal('tankVolume2_fuel.0')
    arr[0].title.should.include('tanks.fuel.0')
  })

  it('computes currentVolume = level * capacity', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(0.5, 0.1)
    out.should.deep.equal([{ path: 'tanks.fuel.0.currentVolume', value: 0.05 }])
  })

  it('returns undefined when level is non-finite', () => {
    // Upstream sensor NaN would otherwise propagate as NaN * capacity
    // and surface in the server log.
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(NaN, 0.1)).to.be.undefined
    expect(arr[0].calculator(undefined as unknown as number, 0.1)).to.be
      .undefined
  })

  it('returns undefined when capacity is non-finite, negative, or zero', () => {
    // Negative or zero capacity is physically meaningless and would
    // emit nonsense volumes downstream (UI gauges, alarms). A
    // misconfigured defaults.json (e.g. signed migration error) or a
    // misbehaving tank sender is the realistic source.
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].calculator(0.5, NaN)).to.be.undefined
    expect(arr[0].calculator(0.5, undefined as unknown as number)).to.be
      .undefined
    expect(arr[0].calculator(0.5, Infinity)).to.be.undefined
    expect(arr[0].calculator(0.5, -1)).to.be.undefined
    expect(arr[0].calculator(0.5, 0)).to.be.undefined
  })

  it('seeds capacity from the data tree so defaults.json capacities work', () => {
    // SignalK's streambundle does not replay deltas to subscribers that
    // attach after defaults.json was applied, so a tank whose capacity
    // lives in defaults would otherwise leave the combined stream stuck
    // waiting on the capacity input.
    const arr = calc(
      makeApp({
        selfPaths: {
          tanks: { fuel: { '0': { capacity: { value: 0.5 } } } }
        }
      }),
      makePlugin()
    )
    arr[0].defaults!.should.deep.equal([undefined, 0.5])
  })

  it('seeds defaults positionally so reordering derivedFrom does not misalign the seed', () => {
    // The defaults array slot for capacity is derived from
    // derivedFromList by matching the capacity path string, not by a
    // hard-coded index. A future maintainer who swaps level and
    // capacity in derivedFromList still gets the seed in the correct
    // slot.
    const arr = calc(
      makeApp({
        selfPaths: {
          tanks: { fuel: { '0': { capacity: { value: 0.5 } } } }
        }
      }),
      makePlugin()
    )
    const derivedFrom = arr[0].derivedFrom()
    const capacityIndex = derivedFrom.indexOf('tanks.fuel.0.capacity')
    capacityIndex.should.be.greaterThan(-1)
    arr[0].defaults![capacityIndex].should.equal(0.5)
    // Every other slot is undefined.
    arr[0].defaults!.forEach((seed: unknown, i: number) => {
      if (i !== capacityIndex) {
        expect(seed).to.be.undefined
      }
    })
  })

  it('leaves defaults undefined when no capacity is in the tree', () => {
    const arr = calc(makeApp(), makePlugin())
    expect(arr[0].defaults).to.be.undefined
  })

  it('skips seeding for non-finite, negative, zero, or non-numeric capacities', () => {
    // A bad value in defaults.json (NaN from a JSON parse glitch, a
    // typo'd negative, a string left over from a migration) should
    // leave defaults unset so the calc falls through to the streamed
    // capacity path rather than seeding a poison value.
    const cases: unknown[] = [null, NaN, Infinity, -Infinity, -1, 0, 'oops', {}]
    cases.forEach((value) => {
      const arr = calc(
        makeApp({
          selfPaths: {
            tanks: { fuel: { '0': { capacity: { value } } } }
          }
        }),
        makePlugin()
      )
      expect(arr[0].defaults, `value=${JSON.stringify(value)}`).to.be.undefined
    })
  })

  it('seeds each tank independently when multiple tanks are configured', () => {
    // The factory maps over plugin.tanks. A closure-capture bug
    // could otherwise cause every tank to read the same capacity path,
    // or seed every tank with the first tank's capacity.
    const plugin = makePlugin()
    plugin.tanks = ['fuel.0', 'freshWater.0', 'blackWater.0']
    const arr = calc(
      makeApp({
        selfPaths: {
          tanks: {
            fuel: { '0': { capacity: { value: 0.5 } } },
            freshWater: { '0': { capacity: { value: 0.2 } } }
          }
        }
      }),
      plugin
    )
    arr.should.have.lengthOf(3)
    arr[0].defaults!.should.deep.equal([undefined, 0.5])
    arr[1].defaults!.should.deep.equal([undefined, 0.2])
    // blackWater has no capacity in the tree, so its defaults stays
    // undefined and the streamed-capacity path is preserved.
    expect(arr[2].defaults).to.be.undefined
  })
})
