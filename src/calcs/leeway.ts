// calculation source: https://arvelgentry.jimdo.com/app/download/9157993883/Arvel+Gentry+-+Sailboat_Performance_Testing_Techniques.pdf?t=1485748085
import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app, plugin): Calculation {
  return {
    group: 'heading',
    optionKey: 'leeway',
    title: 'Leeway',
    derivedFrom: ['navigation.attitude', 'navigation.speedThroughWater'],
    debounceDelay: 200,
    properties: {
      kFactor: {
        type: 'number',
        title:
          'Leeway correlation constant, typically from 9 to 16 (9 for super racer)',
        default: 12
      }
    },
    calculator: function (attitude: { roll: number }, stw: number) {
      const headingProps = plugin.properties?.['heading'] as
        | { kFactor?: number }
        | undefined
      const kFactor = headingProps?.kFactor ?? 12
      const rollDegrees = (attitude.roll / Math.PI) * 360
      const stwKnots = stw * 1.94384
      const leewayAngle =
        stwKnots <= 0
          ? 0
          : ((kFactor * rollDegrees) / (stwKnots * stwKnots) / 360) * Math.PI
      // app.debug('roll: ' + rollDegrees + ' stw: ' + stwKnots + ' knots => leeway: ' + leewayAngle/Math.PI*360)
      return [{ path: 'performance.leeway', value: leewayAngle }]
    }
  }
}

module.exports = factory
