// Shared test helpers for the per-calc unit tests.
//
// makeApp/makePlugin reproduce the minimal shapes the plugin code reads
// from app.* and plugin.* at calculator call time. The defaults mirror
// what a freshly-configured SignalK server plus a mid-size boat would
// pass into the plugin, so tests only need to override the pieces they
// actually exercise.

// Tiny dotted-path getter so tests can feed a vessels-tree stub to the
// calculator and let it read `vessels.<id>.<nav.path>` lookups. Returns
// `undefined` for any missing segment, matching lodash's `_.get`
// behaviour on the shapes this suite passes in.
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc == null ? undefined : (acc as Record<string, unknown>)[key],
      obj
    )
}

export interface TestAppOverrides {
  selfPaths?: Record<string, unknown>
  paths?: Record<string, unknown>
  handleMessage?: (pluginId: string, delta: unknown) => void
  [key: string]: unknown
}

export interface TestApp {
  debug: (msg: string, ...args: unknown[]) => void
  error: (msg: string, ...args: unknown[]) => void
  getSelfPath: (path: string) => unknown
  getPath: (path: string) => unknown
  handleMessage: (pluginId: string, delta: unknown) => void
  selfId: string
  [key: string]: unknown
}

export function makeApp(overrides: TestAppOverrides = {}): TestApp {
  const selfPaths = overrides.selfPaths || {}
  return {
    debug: () => {},
    error: () => {},
    getSelfPath: (p: string) => getPath(selfPaths, p),
    getPath: (p: string) => getPath(overrides.paths || {}, p),
    handleMessage: overrides.handleMessage || (() => {}),
    selfId: 'test',
    ...overrides
  }
}

export interface TestPlugin {
  id: string
  engines: string[]
  batteries: string[]
  tanks: string[]
  air: string[]
  properties: Record<string, unknown>
  [key: string]: unknown
}

export function makePlugin(extra: Record<string, unknown> = {}): TestPlugin {
  return {
    id: 'derived-data',
    engines: ['port'],
    batteries: ['0', '1'],
    tanks: ['fuel.0'],
    air: ['outside'],
    properties: {
      heading: { kFactor: 12 },
      tanks: {
        volume_unit: 'litres',
        'calibrations.fuel.0': [
          { level: 0, volume: 0 },
          { level: 0.5, volume: 50 },
          { level: 1, volume: 100 }
        ]
      },
      traffic: {
        range: 1852,
        distanceToSelf: true,
        timelimit: 30,
        sendNotifications: true,
        notificationZones: []
      },
      moon: { forecastDays: 0 },
      sun: { forecastDays: 0 },
      ...extra
    }
  }
}
