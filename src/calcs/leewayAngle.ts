// calculation source: https://arvelgentry.jimdo.com/app/download/9157993883/Arvel+Gentry+-+Sailboat_Performance_Testing_Techniques.pdf?t=1485748085
import type { Calculation, CalculationFactory } from '../types'

// Real physical leeway rarely exceeds ~30°. Larger HDT/COG
// disagreements almost always come from a transient mismatch (tacks,
// current, GPS lag) rather than actual sideslip, so clamp them
// instead of publishing them. Same bound as the Sail_Instrument
// reference (quantenschaum/Sail_Instrument).
const LEEWAY_LIMIT = Math.PI / 6

const factory: CalculationFactory = function (_app, _plugin): Calculation {
  return {
    group: 'heading',
    optionKey: 'leewayAngle',
    title: 'Leeway Angle',
    derivedFrom: ['navigation.headingTrue', 'navigation.courseOverGroundTrue'],
    debounceDelay: 200,
    calculator: function (hdg: number, cog: number) {
      let leewayAngle: number | null = null
      if (Number.isFinite(hdg) && Number.isFinite(cog)) {
        // Leeway is the angle between HDT and the boat's actual
        // track through the water, with positive = to starboard
        // (Sail_Instrument convention: CTW = HDT + LEE, so
        // LEE = CTW - HDT; we substitute COG for CTW in the
        // absence of a current estimate). atan2 folds the delta
        // into (-PI, PI] so the 0/2*PI wrap needs no branch.
        const delta = cog - hdg
        const circular = Math.atan2(Math.sin(delta), Math.cos(delta))
        leewayAngle = Math.max(-LEEWAY_LIMIT, Math.min(LEEWAY_LIMIT, circular))
      }
      return [{ path: 'navigation.leewayAngle', value: leewayAngle }]
    }
  }
}

module.exports = factory
