/*
 * Copyright 2017 Scott Bender <scott@scottbender.net>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Signal K derived-data plugin entry point.
 *
 * Loads every calculator under `calcs/`, wires its `derivedFrom` paths
 * into the host server's Bacon.js streams, and forwards the calculator
 * output back through `app.handleMessage`. The schema/uiSchema builder
 * discovers the same set of calculators so the plugin's configuration
 * UI stays in sync with whatever lives in `calcs/`.
 */

import * as path from 'path'
import * as fs from 'fs'
import type {
  BaconStream,
  BaconProperty,
  Calculation,
  CalculationFactory,
  PluginInstance,
  PluginProperties,
  PluginState,
  ServerApp,
  SignalKDelta,
  SignalKValue
} from './types'

// Combine N streams into a single Property whose values are fn(v1, v2, ...vN),
// using only the instance-method .combine(other, fn) that exists on both
// baconjs 1.x and 3.x. Avoids require('baconjs') in the plugin so that
// the plugin never carries its own Bacon copy: all stream operations run on
// the Bacon instance the host signalk-server created the streams with.
//
// The seed of the reduce calls .toProperty() so the result is always a
// Property even when there is only one input stream (no .combine call to
// implicitly lift it). Downstream callers depend on .changes(), which is a
// Property-only method.
function combineStreamsWith(
  streams: Array<BaconStream<unknown> | BaconProperty<unknown>>,
  fn: (...args: unknown[]) => unknown
): BaconProperty<unknown> {
  // Seed the reduce with streams[0] lifted to a Property<unknown[]> so
  // the running accumulator never holds null. Iterating streams.slice(1)
  // avoids the null-seeded branch that needed a `!` non-null assertion
  // and would have crashed downstream as `null.map` if a caller ever
  // passed an empty stream list.
  if (streams.length === 0) {
    throw new Error('combineStreamsWith requires at least one stream')
  }
  const first = streams[0]!.toProperty().map((v: unknown): unknown[] => [v])
  return streams
    .slice(1)
    .reduce<BaconProperty<unknown[]>>(
      (acc, stream) =>
        acc.combine(stream, (arr: unknown[], v: unknown) =>
          arr.concat([v])
        ) as BaconProperty<unknown[]>,
      first
    )
    .map((args: unknown[]) => fn.apply(null, args))
}

const defaultEngines = 'port, starboard'
const defaultBatteries = '0'
const defaultTanks = 'fuel.0, fuel.1'
const defaultAir = 'outside'

// Shallow equality for the array of {path, value} deltas that calculators
// return. This is the hot path: it runs on every calculation emission when
// a TTL is configured. Replaces a previous isDeepStrictEqual call which
// walked the structure recursively.
//
// For the simple {path, value} shape (the overwhelming majority of calcs),
// this is ~an order of magnitude faster than isDeepStrictEqual and
// allocates nothing. For anything else (cpa_tcpa-style {context, updates}
// deltas), non-identical references are treated as not-equal and the
// delta is emitted — which is safer than incorrectly suppressing a
// legitimate update, and the TTL still bounds the downstream emit rate.
function deltaValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i] as { path?: unknown; value?: unknown } | null | undefined
    const y = b[i] as { path?: unknown; value?: unknown } | null | undefined
    if (x === y) continue
    if (!x || !y) return false
    // Only dedup the simple {path, value} shape; other shapes fall
    // through as "not equal" and get emitted.
    if (typeof x.path !== 'string' || x.path !== y.path) return false
    if (x.value !== y.value) return false
  }
  return true
}

// Returns the oldest timestamp among the source paths that have
// actually produced a value, or undefined if none have. Lex comparison
// of ISO-8601 UTC strings gives the same ordering as chronological
// comparison without allocating a Date per call — SignalK servers
// always emit Z-suffixed timestamps, so the assumption holds for
// real traffic; edge cases with offset-bearing timestamps would still
// sort stably, just not correctly against Z-suffixed ones.
//
// Paths not present in the map are skipped: a calculator whose source
// was seeded from `defaults` but has never received a real delta
// shouldn't drag the derived timestamp back to the Unix epoch.
function minTimestampFor(
  paths: string[],
  lastTimestampByPath: Map<string, string>
): string | undefined {
  let min: string | undefined
  for (const p of paths) {
    const ts = lastTimestampByPath.get(p)
    if (ts === undefined) continue
    if (min === undefined || ts < min) {
      min = ts
    }
  }
  return min
}

// Builds the skipDuplicates callback used for every calculation emission.
// Extracted to module scope so it can be unit-tested directly and so the
// hot per-emit path is not re-closured per calc at plugin.start time.
//
// Behavior:
// - When no TTL is configured, returns null. Callers should interpret
//   this as "do not chain .skipDuplicates() at all" — there is no work
//   for it to do, and skipping the Bacon operator saves one dispatch per
//   emit.
// - When a TTL is set, consecutive equal values within the TTL window
//   are suppressed. The first unique (or expired) value updates
//   calculation.nextOutput.
function createSkipFunction(
  calculation: { ttl?: number; nextOutput?: number },
  defaultTtl: number | undefined
): ((before: unknown, after: unknown) => boolean) | null {
  const hasTtl =
    (typeof calculation.ttl !== 'undefined' && calculation.ttl > 0) ||
    (defaultTtl !== undefined && defaultTtl > 0)

  if (!hasTtl) {
    return null
  }

  return function (before: unknown, after: unknown): boolean {
    const tnow = Date.now()
    if (deltaValuesEqual(before, after)) {
      // Values are equal but we still emit periodically so downstream
      // consumers see heartbeats even when the source is stuck. On a
      // Pi Zero W the extra cycles reduce power consumption.
      if (
        calculation.nextOutput !== undefined &&
        calculation.nextOutput > tnow
      ) {
        return true
      }
    }

    const ttl =
      typeof calculation.ttl === 'undefined'
        ? (defaultTtl ?? 0)
        : calculation.ttl

    calculation.nextOutput = tnow + ttl * 1000
    return false
  }
}

const createPlugin = function (app: ServerApp): PluginState {
  const plugin = {} as PluginState
  let unsubscribes: Array<() => void> = []
  let schema: Record<string, unknown> | undefined
  let uiSchema: Record<string, unknown> | undefined
  let calculations: Calculation[] | undefined

  // Source-timestamp tracking. The server's `registerDeltaInputHandler`
  // hook runs before the streambundle is updated, so by the time a
  // calculator fires we already have the timestamp of every source
  // value that contributed to its inputs. Storing them here lets the
  // emit path stamp derived deltas with `min(source timestamps)` so
  // downstream staleness detection works and filestream replay lands
  // at the replayed time rather than wall-clock now.
  //
  // Kept at createPlugin closure scope (not inside plugin.start) so
  // that plugin restarts reuse the same handler registration — the
  // server exposes no unregister hook — and so that the map outlives
  // any transient stop/start cycle the user triggers from the config
  // UI. The map is cleared on stop to drop stale entries before the
  // next session.
  const lastTimestampByPath = new Map<string, string>()
  let inputHandlerRegistered = false

  plugin.start = function (props: PluginProperties) {
    plugin.properties = props

    if (!plugin.properties.engine_instances) {
      plugin.properties.engine_instances = defaultEngines
    }
    if (!plugin.properties.battery_instances) {
      plugin.properties.battery_instances = defaultBatteries
    }
    if (!plugin.properties.tank_instances) {
      plugin.properties.tank_instances = defaultTanks
    }
    if (!plugin.properties.air_instances) {
      plugin.properties.air_instances = defaultAir
    }
    if (!plugin.properties.traffic) {
      plugin.properties.traffic = {}
    }
    if (!plugin.properties.traffic.notificationZones) {
      plugin.properties.traffic.notificationZones = []
    }
    updateOldTrafficConfig()
    plugin.engines = plugin.properties.engine_instances
      .split(',')
      .map((e: string) => e.trim())
    plugin.batteries = plugin.properties.battery_instances
      .split(',')
      .map((e: string) => e.trim())
    plugin.tanks = plugin.properties.tank_instances
      .split(',')
      .map((e: string) => e.trim())
    plugin.air = plugin.properties.air_instances
      .split(',')
      .map((e: string) => e.trim())
    calculations = flattenCalcs(load_calcs(app, plugin, 'calcs'))

    if (!inputHandlerRegistered && app.registerDeltaInputHandler) {
      // Observe inbound self deltas and record the latest timestamp
      // per source path. `value.timestamp` wins over `update.timestamp`
      // because SignalK lets per-value timestamps override the update
      // default, and we always forward the delta unchanged via next().
      const selfContext = 'vessels.' + app.selfId
      app.registerDeltaInputHandler((delta, next) => {
        const ctx = delta.context || selfContext
        if (ctx === selfContext || ctx === 'vessels.self') {
          for (const update of delta.updates || []) {
            const updateTs = update.timestamp
            for (const v of update.values || []) {
              const ts = v.timestamp || updateTs
              if (typeof ts === 'string' && typeof v.path === 'string') {
                lastTimestampByPath.set(v.path, ts)
              }
            }
          }
        }
        next(delta)
      })
      inputHandlerRegistered = true
    }

    calculations.forEach((calculation) => {
      if (calculation.group) {
        const group = props[calculation.group] as
          | Record<string, unknown>
          | undefined
        if (!group || !group[calculation.optionKey]) {
          return
        }
      } else if (!props[calculation.optionKey]) {
        return
      }

      let derivedFrom: string[]

      if (typeof calculation.derivedFrom === 'function') {
        derivedFrom = calculation.derivedFrom()
      } else derivedFrom = calculation.derivedFrom

      const skip_function = createSkipFunction(calculation, props.default_ttl)

      const selfStreams = derivedFrom.map((key: string, index: number) => {
        let stream: BaconStream<unknown> | BaconProperty<unknown>
        /*
        if ( !_.isUndefined(calculation.allContexts) && calculation.allContexts ) {
          stream = app.streambundle.getBus(key)
        } else {
        */
        stream = app.streambundle.getSelfStream(key)
        /* } */
        if (calculation.defaults && calculation.defaults[index] !== undefined) {
          stream = stream.toProperty(calculation.defaults[index])
        }
        return stream
      })

      const combined = combineStreamsWith(
        selfStreams,
        calculation.calculator as (...args: unknown[]) => unknown
      )
      const changes = combined.changes!()
      const debounced = changes.debounceImmediate!(
        calculation.debounceDelay || 20
      )
      // Only chain .skipDuplicates when there is actually a TTL to enforce;
      // createSkipFunction returns null when no TTL is configured, and a
      // no-op skipDuplicates is wasted work on the per-emit path.
      const deduped = skip_function
        ? debounced.skipDuplicates!(skip_function)
        : debounced
      const unsubscribe = deduped.onValue!((values: unknown) => {
        if (
          typeof values !== 'undefined' &&
          Array.isArray(values) &&
          values.length > 0
        ) {
          const first = values[0] as { context?: string } | SignalKValue
          if ((first as { context?: string }).context) {
            // Calculator-authored deltas (cpa_tcpa) carry their own
            // context and manage their own timestamps per emission;
            // stamping them here would overwrite those.
            ;(values as SignalKDelta[]).forEach((delta) => {
              app.handleMessage(plugin.id, delta)
            })
          } else {
            const update: SignalKDelta['updates'][number] = {
              values: values as SignalKValue[]
            }
            const derivedTs = minTimestampFor(derivedFrom, lastTimestampByPath)
            if (derivedTs) {
              update.timestamp = derivedTs
            }
            const delta: SignalKDelta = {
              context: 'vessels.' + app.selfId,
              updates: [update]
            }

            // app.debug("got delta: " + JSON.stringify(delta))
            app.handleMessage(plugin.id, delta)
          }
        }
      })
      unsubscribes.push(unsubscribe)
    })
  }

  plugin.stop = function () {
    unsubscribes.forEach((f) => f())
    unsubscribes = []
    lastTimestampByPath.clear()

    if (calculations) {
      calculations.forEach((calc) => {
        if (calc.stop) {
          calc.stop()
        }
      })
    }
  }

  plugin.id = 'derived-data'
  plugin.name = 'Derived Data'
  plugin.description = 'Plugin that derives data'

  plugin.schema = function () {
    updateSchema()
    return schema!
  }

  plugin.uiSchema = function () {
    updateSchema()
    return uiSchema!
  }

  function updateSchema() {
    if (!calculations) {
      plugin.engines = defaultEngines.split(',').map((e) => e.trim())
      plugin.batteries = defaultBatteries.split(',').map((e) => e.trim())
      plugin.tanks = defaultTanks.split(',').map((e) => e.trim())
      plugin.air = defaultAir.split(',').map((e) => e.trim())

      calculations = flattenCalcs(load_calcs(app, plugin, 'calcs'))
    }

    schema = {
      title: 'Derived Data',
      description:
        'Legend: 👍 Path is present, ❎ Path value = `null`, ❌ Path not present',
      type: 'object',
      properties: {
        default_ttl: {
          title: 'Default TTL',
          type: 'number',
          description:
            "The plugin won't send out duplicate calculation values for this time period (s) (0=no ttl check)",
          default: 0
        },
        engine_instances: {
          title: 'Engines',
          type: 'string',
          description: 'Comma delimited list of available engines',
          default: defaultEngines
        },
        battery_instances: {
          title: 'Batteries',
          type: 'string',
          description: 'Comma delimited list of available batteries',
          default: defaultBatteries
        },
        tank_instances: {
          title: 'Tanks',
          type: 'string',
          description: 'Comma delimited list of available tanks',
          default: defaultTanks
        },
        air_instances: {
          title: 'Air',
          type: 'string',
          description: 'Comma delimited list of available air areas',
          default: defaultAir
        }
      } as Record<string, unknown>
    }

    uiSchema = {
      'ui:order': [
        'default_ttl',
        'engine_instances',
        'battery_instances',
        'tank_instances',
        'air_instances'
      ] as string[]
    }

    const groups: Record<string, Calculation[]> = {}

    calculations.forEach((calc) => {
      let groupName: string

      if (typeof calc.group !== 'undefined') {
        groupName = calc.group
      } else {
        groupName = 'nogroup'
      }

      if (!groups[groupName]) {
        groups[groupName] = []
      }
      let title = `${calc.title.includes('DEPRECATED') ? '❗' : ''}${
        calc.title
      }`
      title += ' ['
      const derivedFrom =
        typeof calc.derivedFrom === 'function'
          ? calc.derivedFrom()
          : calc.derivedFrom
      title += derivedFrom
        .map((p) => {
          const node = app.getSelfPath(p) as
            | { value?: unknown }
            | null
            | undefined
          return `${p}${node ? (node.value === null ? '(❎)' : '(👍)') : '(❌)'}`
        })
        .join(', ')
      title += ']'
      groups[groupName]!.push({ ...calc, title })
    })

    const schemaProps = schema.properties as Record<string, unknown>
    const uiOrder = uiSchema['ui:order'] as string[]

    if (groups['nogroup']) {
      groups['nogroup'].forEach((calc) => {
        uiOrder.push(calc.optionKey)
        schemaProps[calc.optionKey] = {
          title: calc.title,
          type: 'boolean',
          default: false
        }
        if (calc.properties) {
          const props =
            typeof calc.properties === 'function'
              ? calc.properties()
              : calc.properties
          Object.assign(schemaProps, props)
        }
      })
    }

    Object.keys(groups).forEach((groupName) => {
      if (groupName !== 'nogroup') {
        uiOrder.push(groupName)
        ;(uiSchema as Record<string, unknown>)[groupName] = {
          'ui:order': [] as string[],
          'ui:field': 'collapsible',
          collapse: {
            field: 'ObjectField',
            wrapClassName: 'panel-group'
          }
        }
        const group: {
          title: string
          type: string
          properties: Record<string, unknown>
        } = {
          title: groupName.charAt(0).toUpperCase() + groupName.slice(1),
          type: 'object',
          properties: {}
        }
        groups[groupName]!.forEach((calc) => {
          const order = (uiSchema as Record<string, Record<string, unknown>>)[
            groupName
          ]!['ui:order'] as string[]
          order.push(calc.optionKey)
          group.properties[calc.optionKey] = {
            title: calc.title,
            type: 'boolean',
            default: false
          }
          if (calc.properties) {
            const props =
              typeof calc.properties === 'function'
                ? calc.properties()
                : calc.properties
            Object.assign(group.properties, props)
            Object.keys(props).forEach((key) => {
              order.push(key)
            })
          }
        })
        schemaProps[groupName] = group
      }
    })

    // app.debug('schema: ' + JSON.stringify(schema, null, 2))
    // app.debug('uiSchema: ' + JSON.stringify(uiSchema, null, 2))
  }

  function updateOldTrafficConfig() {
    const traffic = plugin.properties!.traffic!
    if (
      traffic.notificationRange !== undefined ||
      traffic.notificationTimeLimit !== undefined
    ) {
      traffic.notificationZones!.push({
        range: traffic.notificationRange || 1852,
        timeLimit: traffic.notificationTimeLimit || 600,
        level: 'alert',
        active: traffic.sendNotifications
      })
      delete traffic.notificationRange
      delete traffic.notificationTimeLimit
      app.savePluginOptions?.(plugin.properties!)
    }
  }

  return plugin
}

function flattenCalcs(
  calcs: Array<Calculation | Calculation[] | undefined>
): Calculation[] {
  // `[].concat.apply([], calculations)` in the JS version handled both
  // single-descriptor and array-of-descriptors modules. Doing it with a
  // typed reduce keeps the shape narrow for downstream consumers.
  const out: Calculation[] = []
  calcs.forEach((c) => {
    if (Array.isArray(c)) out.push(...c)
    else if (c) out.push(c)
  })
  return out
}

function load_calcs(
  app: ServerApp,
  plugin: PluginInstance,
  dir: string
): Array<Calculation | Calculation[]> {
  const fpath = path.join(__dirname, dir)
  // Whitelist runtime modules: `.js` for the published `dist/` package
  // and `.ts` for the in-source mocha+tsx test setup. Reject `.d.ts`
  // declarations and `.map` source maps the build emits alongside each
  // module — they are not requireable and would crash the loader with
  // MODULE_NOT_FOUND.
  const files = fs.readdirSync(fpath).filter((f) => {
    const ext = path.extname(f)
    return (ext === '.js' || ext === '.ts') && !f.endsWith('.d.ts')
  })
  // A single calc throwing at require() time must not take down the
  // rest of the plugin. Calcs frequently import native-ish packages
  // (geomagnetism's WMM data, baconjs version mismatches, ...) whose
  // failure modes only show up on a customer's machine, long after
  // tests have passed. Logging the failure and dropping the calc
  // keeps every other calc online and gives the customer a filename
  // to grep for in the server log.
  return files
    .map((fname) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod: CalculationFactory = require(path.join(fpath, fname))
        return mod(app, plugin)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        app.error(`failed to load calc ${fname}: ${msg}`)
        return undefined
      }
    })
    .filter((calc): calc is Calculation | Calculation[] => calc != null)
}

// `export = createPlugin` emits `module.exports = createPlugin` so the
// signalk-server plugin loader (plain CJS `require(...)`) continues to
// receive the factory directly. The named form (vs the older
// `module.exports = ...` assignment) gives tsc a concrete symbol to
// emit into the `.d.ts`, so consumers see the real factory signature
// instead of the opaque `export {}` the older pattern produced.
//
// A namespace merge on the same identifier re-exports the companion
// types from the package root. `export =` forbids named exports, so
// the merge is the canonical way to make
//   import type { ServerApp } from 'signalk-derived-data'
// resolve without forcing consumers into brittle subpath imports.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace createPlugin {
  export type ServerApp = import('./types').ServerApp
  export type PluginProperties = import('./types').PluginProperties
  export type PluginInstance = import('./types').PluginInstance
  export type PluginState = import('./types').PluginState
  export type Calculation = import('./types').Calculation
  export type CalculationFactory = import('./types').CalculationFactory
  export type CalculationTest = import('./types').CalculationTest
  export type CalculatorFn = import('./types').CalculatorFn
  export type CalculatorOutput = import('./types').CalculatorOutput
  export type SignalKDelta = import('./types').SignalKDelta
  export type SignalKUpdate = import('./types').SignalKUpdate
  export type SignalKValue = import('./types').SignalKValue
  export type SignalKPluginDefinition =
    import('./types').SignalKPluginDefinition
  export type BaconStream<T = unknown> = import('./types').BaconStream<T>
  export type BaconProperty<T = unknown> = import('./types').BaconProperty<T>
  export type StreamBundle = import('./types').StreamBundle
}

// Exposed for unit testing. The main export below is still the plugin
// factory used by the Signal K server. We hang these on the factory
// itself so they survive the `export = createPlugin` reassignment that
// tsc emits at the bottom of the file.
;(createPlugin as any).createSkipFunction = createSkipFunction
;(createPlugin as any).deltaValuesEqual = deltaValuesEqual
;(createPlugin as any).minTimestampFor = minTimestampFor

export = createPlugin
