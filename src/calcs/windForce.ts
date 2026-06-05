import type { Calculation, CalculationFactory } from '../types'

const factory: CalculationFactory = function (_app): Calculation {
  return {
    group: 'wind',
    optionKey: 'force',
    title: 'Wind Force',
    derivedFrom:  [
      'environment.wind.speedTrue'
    ],
    calculator: function (speed: number) {

        if (!speed || !Number.isFinite(speed) || speed < 0.0) {
            return [{ path: 'environment.wind.force', value: null }, { path: 'environment.wind.forceDescription', value: '' }]
        }

        var force = 0;
        var description = 'Calm';
        if (speed <= 0.2) {
            force = 0;
            description = 'Calm';
        }
        else if (speed <= 1.5) {
            force = 1;
            description = 'Light Air';
        } else if (speed <= 3.3) {
            force = 2;
            description = 'Light Breeze';
        } else if (speed <= 5.4) {
            force = 3;
            description = 'Gentle Breeze';
        } else if (speed <= 7.9) {
            force = 4;
            description = 'Moderate Breeze';
        } else if (speed <= 10.7) {
            force = 5;
            description = 'Fresh Breeze';
        } else if (speed <= 13.8) {
            force = 6;
            description = 'Strong Breeze';
        } else if (speed <= 17.1) {
            force = 7;
            description = 'Near Gale';
        } else if (speed <= 20.7) {
            force = 8;
            description = 'Gale';
        } else if (speed <= 24.4) {
            force = 9;
            description = 'Severe Gale';
        } else if (speed <= 28.4) {
            force = 10;
            description = 'Storm';
        } else if (speed <= 32.6) {
            force = 11;
            description = 'Violent Storm';
        } else {
            force = 12;
            description = 'Hurricane Force';
        }

        return [{ path: 'environment.wind.force', value: force }, { path: 'environment.wind.forceDescription', value: description }]
    }
  }
}

module.exports = factory
