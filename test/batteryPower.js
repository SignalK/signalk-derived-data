// Tests marked with `// BUG: ...` lock the CURRENT (incorrect) behaviour
// of the module so the suite stays green today. A follow-up pass flips
// those assertions to the correct behaviour and fixes the implementations.

const chai = require('chai')
chai.Should()

const { makeApp, makePlugin } = require('./helpers')

describe('batteryPower', () => {
  const calc = require('../calcs/batteryPower')

  it('produces one descriptor per configured battery instance', () => {
    const arr = calc(makeApp(), makePlugin())
    arr.should.have.lengthOf(2)
    arr[0].group.should.equal('electrical')
    arr[0]
      .derivedFrom()
      .should.deep.equal([
        'electrical.batteries.0.voltage',
        'electrical.batteries.0.current'
      ])
  })

  it('multiplies voltage by current', () => {
    const arr = calc(makeApp(), makePlugin())
    const out = arr[0].calculator(12.5, 4)
    out.should.deep.equal([{ path: 'electrical.batteries.0.power', value: 50 }])
  })

  // BUG: the option key is misspelled as 'batterPower' (missing 'y').
  // Kept as-is because existing user configs depend on the spelling.
  it('uses the current (misspelled) optionKey', () => {
    const arr = calc(makeApp(), makePlugin())
    arr[0].optionKey.should.equal('batterPower0')
    arr[1].optionKey.should.equal('batterPower1')
  })
})
