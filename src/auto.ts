/**
 * Auto mode: picks the calculations whose inputs are available.
 *
 * Kept free of server and stream access so the selection rules can be
 * unit-tested; index.ts feeds it what the data model holds and wires
 * the result.
 */

import type { Calculation } from './types'

export type Mode = 'auto' | 'manual'

// Sensors on NMEA 2000 and similar buses report a few seconds after the
// server starts. Selecting earlier would start a calculation just before
// the sensor that makes it redundant shows up.
export const AUTO_START_DELAY_MS = 60_000
export const AUTO_POLL_INTERVAL_MS = 15_000
// Calculations from position and time alone, such as sun mode, run on
// almost every boat and recompute on each navigation.datetime update, so
// auto mode holds back unchanged values unless the user set a TTL.
export const AUTO_DEFAULT_TTL = 5

export type AutoStatus =
  | { state: 'active' }
  | { state: 'waiting'; missing: string[] }
  | { state: 'fromSensor'; paths: string[] }
  | { state: 'fromCalculation'; paths: string[] }
  | { state: 'excluded' }

export interface DataModel {
  // The path has a value from a source other than this plugin.
  hasForeignValue: (path: string) => boolean
  // getSelfPath(path) returns a value, from any source.
  hasValue: (path: string) => boolean
}

// A configuration without any settings is what the server passes to a
// plugin it enabled by default, that is, a fresh install. A saved
// configuration without `mode` predates auto mode and stays manual.
export function resolveMode(config: object | undefined): Mode {
  if (!config || Object.keys(config).length === 0) return 'auto'
  return (config as { mode?: unknown }).mode === 'auto' ? 'auto' : 'manual'
}

/**
 * Whether a data model node, as getSelfPath returns it, holds a value
 * from a source other than `ownSource`. For a branch such as
 * `environment.moon` any leaf below it counts.
 */
export function hasForeignSource(node: unknown, ownSource: string): boolean {
  if (!node || typeof node !== 'object') return false
  const leaf = node as { $source?: unknown; values?: unknown }
  if (leaf.values && typeof leaf.values === 'object') {
    return Object.keys(leaf.values).some((source) => source !== ownSource)
  }
  if (typeof leaf.$source === 'string') return leaf.$source !== ownSource
  if ('value' in leaf) return true
  return Object.entries(node).some(
    ([key, child]) => key !== 'meta' && hasForeignSource(child, ownSource)
  )
}

export function calculationKey(calc: Calculation): string {
  return `${calc.group ?? ''}/${calc.optionKey}`
}

export function derivedFromOf(calc: Calculation): string[] {
  return typeof calc.derivedFrom === 'function'
    ? calc.derivedFrom()
    : calc.derivedFrom
}

function isEligible(calc: Calculation): boolean {
  return (
    calc.auto !== false &&
    calc.outputs !== undefined &&
    calc.outputs.length > 0 &&
    !calc.title.includes('DEPRECATED')
  )
}

/**
 * Decides which calculations run. A calculation is chosen when
 * - none of its outputs comes from another source, so the plugin never
 *   competes with a sensor on the same path,
 * - none of its outputs is written by a calculation chosen before it;
 *   alternatives (wind direction A/B, VMG A/B, depth below keel from
 *   surface or from transducer) are tried in the order given,
 * - each input comes from another source or from a chosen calculation,
 *   so chains such as magnetic variation -> true heading -> leeway angle
 *   work, while two calculations that only feed each other (belowKeel
 *   and belowSurface) never start, and
 * - the vessel data it requires is set.
 */
export function selectCalculations(
  calculations: Calculation[],
  model: DataModel
): Map<string, AutoStatus> {
  const status = new Map<string, AutoStatus>()
  const produced = new Set<string>()
  const candidates: Calculation[] = []

  for (const calc of calculations) {
    if (isEligible(calc)) {
      candidates.push(calc)
    } else {
      status.set(calculationKey(calc), { state: 'excluded' })
    }
  }

  let chosenInPass = true
  while (chosenInPass) {
    chosenInPass = false
    for (const calc of candidates) {
      const key = calculationKey(calc)
      if (status.get(key)?.state === 'active') continue

      const outputs = calc.outputs!
      const fromSensor = outputs.filter((p) => model.hasForeignValue(p))
      if (fromSensor.length > 0) {
        status.set(key, { state: 'fromSensor', paths: fromSensor })
        continue
      }
      const fromCalculation = outputs.filter((p) => produced.has(p))
      if (fromCalculation.length > 0) {
        status.set(key, { state: 'fromCalculation', paths: fromCalculation })
        continue
      }
      const missing = [
        ...derivedFromOf(calc).filter(
          (p) => !produced.has(p) && !model.hasForeignValue(p)
        ),
        ...(calc.requires ?? []).filter((p) => !model.hasValue(p))
      ]
      if (missing.length > 0) {
        status.set(key, { state: 'waiting', missing })
        continue
      }

      status.set(key, { state: 'active' })
      outputs.forEach((p) => produced.add(p))
      chosenInPass = true
    }
  }
  return status
}

export function describeStatus(status: AutoStatus): string {
  switch (status.state) {
    case 'active':
      return 'auto: active'
    case 'waiting':
      return `auto: waiting for ${status.missing.join(', ')}`
    case 'fromSensor':
      return `auto: skipped, ${status.paths.join(', ')} already comes from another source`
    case 'fromCalculation':
      return `auto: skipped, ${status.paths.join(', ')} already comes from another calculation`
    case 'excluded':
      return 'auto: never enabled automatically'
  }
}

export interface Instances {
  engines: string[]
  batteries: string[]
  tanks: string[]
}

function childBranches(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  return Object.entries(node)
    .filter(
      ([, child]) => child && typeof child === 'object' && !('value' in child)
    )
    .map(([key]) => key)
}

// Engines, batteries and tanks as they appear in the data model, in the
// `<type>.<id>` form the tank calculations take.
export function discoverInstances(
  getSelfPath: (path: string) => unknown
): Instances {
  const tanksNode = getSelfPath('tanks') as Record<string, unknown> | undefined
  return {
    engines: childBranches(getSelfPath('propulsion')),
    batteries: childBranches(getSelfPath('electrical.batteries')),
    tanks: childBranches(tanksNode).flatMap((type) =>
      childBranches(tanksNode![type]).map((id) => `${type}.${id}`)
    )
  }
}
