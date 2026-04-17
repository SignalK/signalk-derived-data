/**
 * Shared types for the signalk-derived-data plugin.
 *
 * `ServerApp` is the minimal shape of the Signal K server instance the
 * plugin actually touches at runtime (streambundle, logging helpers,
 * plugin hooks). The real server passes in a much larger object; we
 * only type what this plugin reads so the types stay honest without
 * taking a dependency on the server's full API.
 */

// Bacon.js stream shape reduced to the methods the plugin uses. Both
// baconjs 1.x and 3.x expose these, which is why the plugin avoids
// requiring baconjs directly (see `combineStreamsWith` in index.ts).
export interface BaconStream<T = unknown> {
  toProperty: (seed?: T) => BaconProperty<T>
  map: <U>(fn: (value: T) => U) => BaconStream<U>
  combine: <U, R>(
    other: BaconStream<U> | BaconProperty<U>,
    fn: (a: T, b: U) => R
  ) => BaconStream<R>
  changes?: () => BaconStream<T>
  debounceImmediate?: (ms: number) => BaconStream<T>
  skipDuplicates?: (fn: (before: T, after: T) => boolean) => BaconStream<T>
  onValue?: (fn: (value: T) => void) => () => void
}

export type BaconProperty<T = unknown> = BaconStream<T>

export interface StreamBundle {
  getSelfStream: (path: string) => BaconStream<unknown>
}

// A Signal K delta as emitted by the plugin. Most calculators return
// the "inner" form (list of path+value entries) and the plugin wraps
// them in a self-context update; cpa_tcpa additionally emits the full
// wrapped form with its own context.
export interface SignalKValue {
  path: string
  value: unknown
  timestamp?: string
}

export interface SignalKUpdate {
  values: SignalKValue[]
  source?: Record<string, unknown>
  timestamp?: string
}

export interface SignalKDelta {
  context: string
  updates: SignalKUpdate[]
}

export type CalculatorOutput =
  | SignalKValue[]
  | SignalKDelta[]
  | undefined
  | null
  | void

export type CalculatorFn = (...args: any[]) => CalculatorOutput

export interface CalculationTest {
  input: unknown[]
  selfData?: Record<string, unknown>
  expected?: SignalKValue[] | undefined
  expectedRange?: Array<{ path: string; value: number; delta: number }>
}

export interface Calculation {
  group?: string
  optionKey: string
  title: string
  derivedFrom: string[] | (() => string[])
  defaults?: unknown[]
  debounceDelay?: number
  ttl?: number
  properties?: Record<string, unknown> | (() => Record<string, unknown>)
  calculator: CalculatorFn
  stop?: () => void
  tests?: CalculationTest[]
  // Mutated at runtime by plugin.start() to carry the next allowed
  // emit timestamp for the ttl-throttled skip_function.
  nextOutput?: number
}

// load_calcs returns either a single Calculation, an array of them, or
// nothing per file; plugin.start flattens before use. `null` is a valid
// "skip me" return in addition to `undefined` — the runtime filter in
// `load_calcs` treats both as "no calculation" and `flattenCalcs`
// correctly ignores them via the `else if (c)` branch.
export type CalculationModule = Calculation | Calculation[] | undefined | null
export type CalculationFactory = (
  app: ServerApp,
  plugin: PluginInstance
) => CalculationModule

export interface PluginProperties {
  default_ttl?: number
  engine_instances?: string
  battery_instances?: string
  tank_instances?: string
  air_instances?: string
  traffic?: {
    notificationRange?: number
    notificationTimeLimit?: number
    sendNotifications?: boolean
    notificationZones?: Array<{
      range: number
      timeLimit: number
      level: string
      active?: boolean
    }>
    range?: number
    distanceToSelf?: boolean
    timelimit?: number
  }
  [key: string]: unknown
}

export interface PluginInstance {
  id: string
  name?: string
  description?: string
  engines?: string[]
  batteries?: string[]
  tanks?: string[]
  air?: string[]
  properties?: PluginProperties
  [key: string]: unknown
}

export interface ServerApp {
  selfId: string
  debug: (msg: string, ...args: unknown[]) => void
  error: (msg: string, ...args: unknown[]) => void
  getSelfPath: (path: string) => unknown
  getPath: (path: string) => unknown
  handleMessage: (pluginId: string, delta: SignalKDelta) => void
  streambundle: StreamBundle
  savePluginOptions?: (props: PluginProperties) => void
  setPluginStatus?: (msg: string) => void
  setPluginError?: (msg: string) => void
  registerDeltaInputHandler?: (fn: (delta: SignalKDelta) => void) => void
  signalk?: { self?: unknown }
}

export interface SignalKPluginDefinition {
  id: string
  name: string
  description: string
  schema: Record<string, unknown> | (() => Record<string, unknown>)
  uiSchema?: Record<string, unknown> | (() => Record<string, unknown>)
  start: (options: PluginProperties, restartPlugin?: () => void) => void
  stop: () => void
  [key: string]: unknown
}

// The plugin factory's return type. Extends the signalk-server plugin
// contract with the per-instance configuration the derived-data plugin
// carries after `start()` runs (engine/battery/tank lists).
export interface PluginState extends SignalKPluginDefinition {
  properties?: PluginProperties
  engines?: string[]
  batteries?: string[]
  tanks?: string[]
  air?: string[]
}
