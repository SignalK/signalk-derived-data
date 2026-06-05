
import * as chai from 'chai'
chai.should()

import { makeApp, makePlugin } from './helpers'

describe('windForce', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const calc: any = require('../src/calcs/windForce')

  it('produces correct descriptor', () => {
    const calculator = calc(makeApp(), makePlugin())
    calculator.group.should.equal('wind')
    calculator
      .derivedFrom
      .should.deep.equal([
        'environment.wind.speedTrue'
      ])
  })

  it('calculates force for null wind', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(null)
    out.should.deep.equal([{ path: 'environment.wind.force', value: null }, { path: 'environment.wind.forceDescription', value: '' }])
  })
  
  it('calculates force for negative wind', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(-3)
    out.should.deep.equal([{ path: 'environment.wind.force', value: null }, { path: 'environment.wind.forceDescription', value: '' }])
  })
  
  it('calculates force for infinite wind', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(Number.POSITIVE_INFINITY)
    out.should.deep.equal([{ path: 'environment.wind.force', value: null }, { path: 'environment.wind.forceDescription', value: '' }])
  })
  
  it('calculates force for NaN wind', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(Number.NaN)
    out.should.deep.equal([{ path: 'environment.wind.force', value: null }, { path: 'environment.wind.forceDescription', value: '' }])
  })
  
  it('calculates force for no wind', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(0.1)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 0 }, { path: 'environment.wind.forceDescription', value: 'Calm' }])
  })

  it('calculates force 1', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(1.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 1 }, { path: 'environment.wind.forceDescription', value: 'Light Air' }])
  })

  it('calculates force 2', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(3.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 2 }, { path: 'environment.wind.forceDescription', value: 'Light Breeze' }])
  })

  it('calculates force 3', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(5.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 3 }, { path: 'environment.wind.forceDescription', value: 'Gentle Breeze' }])
  })

  it('calculates force 4', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(7.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 4}, { path: 'environment.wind.forceDescription', value: 'Moderate Breeze' }])
  })

  it('calculates force 5', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(10.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 5 }, { path: 'environment.wind.forceDescription', value: 'Fresh Breeze' }])
  })

  it('calculates force 6', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(13.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 6 }, { path: 'environment.wind.forceDescription', value: 'Strong Breeze' }])
  })

  it('calculates force 7', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(17.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 7 }, { path: 'environment.wind.forceDescription', value: 'Near Gale' }])
  })

  it('calculates force 8', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(20.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 8 }, { path: 'environment.wind.forceDescription', value: 'Gale' }])
  })

  it('calculates force 9', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(24.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 9 }, { path: 'environment.wind.forceDescription', value: 'Severe Gale' }])
  })

  it('calculates force 10', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(28.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 10 }, { path: 'environment.wind.forceDescription', value: 'Storm' }])
  })

  it('calculates force 11', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(32.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 11 }, { path: 'environment.wind.forceDescription', value: 'Violent Storm' }])
  })

  it('calculates force 12', () => {
    const calculator = calc(makeApp(), makePlugin())
    const out = calculator.calculator(100.0)
    out.should.deep.equal([{ path: 'environment.wind.force', value: 12 }, { path: 'environment.wind.forceDescription', value: 'Hurricane Force' }])
  })
})

