import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Catalog types
//
// The plugin's JSON Schema is dense (groups, intermingled calc toggles and
// extras, instance-templated optionKeys, etc.) so the panel walks the schema
// once into a flat catalog the React tree can render directly.
// ---------------------------------------------------------------------------

type PathStatus = 'ok' | 'null' | 'missing'

interface Calc {
  optionKey: string
  /** Calculator label with the `[paths]` suffix already stripped. */
  title: string
  /** Marks `❗DEPRECATED` calcs so the row can de-emphasise them. */
  deprecated: boolean
  /** Required SignalK paths parsed from the schema title. */
  paths: string[]
  /** Calc-specific config fields (anything in the group that isn't another calc toggle). */
  extras: ExtraField[]
}

interface Group {
  name: string
  title: string
  calcs: Calc[]
}

type ExtraField =
  | NumberField
  | StringField
  | BooleanField
  | EnumField
  | ArrayObjectField
  | UnknownField

interface BaseField {
  key: string
  title: string
  description?: string
  default?: unknown
}
interface NumberField extends BaseField {
  type: 'number'
}
interface StringField extends BaseField {
  type: 'string'
}
interface BooleanField extends BaseField {
  type: 'boolean'
}
interface EnumField extends BaseField {
  type: 'enum'
  enum: Array<string | number>
}
interface ArrayObjectField extends BaseField {
  type: 'array-object'
  itemFields: ExtraField[]
}
interface UnknownField extends BaseField {
  type: 'unknown'
  raw: unknown
}

interface Catalog {
  globals: ExtraField[]
  groups: Group[]
}

// ---------------------------------------------------------------------------
// Schema property shapes (loose — schemas come over the wire as `unknown`)
// ---------------------------------------------------------------------------

interface SchemaProperty {
  type?: string
  title?: string
  description?: string
  default?: unknown
  enum?: Array<string | number>
  properties?: Record<string, SchemaProperty>
  items?: SchemaProperty
}

interface PluginSchema extends SchemaProperty {
  properties?: Record<string, SchemaProperty>
}

interface PluginUiSchema {
  'ui:order'?: string[]
  [groupName: string]: unknown
}

interface PluginMeta {
  id: string
  schema: PluginSchema | (() => PluginSchema)
  uiSchema?: PluginUiSchema | (() => PluginUiSchema)
}

const GLOBAL_KEYS = new Set([
  'default_ttl',
  'engine_instances',
  'battery_instances',
  'tank_instances',
  'air_instances'
])

// Schema titles for calc toggles end with the bracketed path list, e.g.
//   `Outside air density [environment.outside.temperature(👍), ...]`
// Extras (number, enum, sub-toggle) never carry this suffix. Used to pick
// calc rows out of the otherwise-flat group property bag.
const TITLE_BRACKET_RE = /\s*\[(.+)\]$/

// Strip the inline status emoji `(👍)`, `(❎)`, `(❌)` the schema injects
// per path. The panel renders its own live status icons from
// `/signalk/v1/api/vessels/self` instead.
const PATH_SUFFIX_RE = /\([^)]*\)$/

function parseCalcTitle(rawTitle: string): {
  title: string
  paths: string[]
  deprecated: boolean
} {
  let title = rawTitle
  let deprecated = false
  if (title.startsWith('❗')) {
    deprecated = true
    title = title.slice(1)
  }
  const m = TITLE_BRACKET_RE.exec(title)
  if (!m) return { title, paths: [], deprecated }
  const head = title.slice(0, m.index)
  const paths = m[1]!.split(', ').map((p) => p.replace(PATH_SUFFIX_RE, ''))
  return { title: head.trim(), paths, deprecated }
}

function toExtraField(key: string, prop: SchemaProperty): ExtraField {
  const base: BaseField = {
    key,
    title: prop.title ?? key,
    description: prop.description,
    default: prop.default
  }
  if (prop.enum && prop.enum.length > 0) {
    return { ...base, type: 'enum', enum: prop.enum }
  }
  if (
    prop.type === 'array' &&
    prop.items &&
    prop.items.type === 'object' &&
    prop.items.properties
  ) {
    const itemFields = Object.entries(prop.items.properties).map(([k, v]) =>
      toExtraField(k, v)
    )
    return { ...base, type: 'array-object', itemFields }
  }
  if (prop.type === 'number') return { ...base, type: 'number' }
  if (prop.type === 'string') return { ...base, type: 'string' }
  if (prop.type === 'boolean') return { ...base, type: 'boolean' }
  return { ...base, type: 'unknown', raw: prop }
}

function isCalcToggle(prop: SchemaProperty): boolean {
  return (
    prop.type === 'boolean' && !!prop.title && TITLE_BRACKET_RE.test(prop.title)
  )
}

function buildCatalog(schema: PluginSchema, uiSchema: PluginUiSchema): Catalog {
  const props = schema.properties ?? {}
  const order = uiSchema['ui:order'] ?? Object.keys(props)

  const globals: ExtraField[] = []
  const groups: Group[] = []

  for (const key of order) {
    const prop = props[key]
    if (!prop) continue
    if (GLOBAL_KEYS.has(key)) {
      globals.push(toExtraField(key, prop))
      continue
    }
    if (prop.type !== 'object' || !prop.properties) continue

    // Walk the group's ui:order, pairing extras with their preceding calc.
    const groupUi =
      (uiSchema[key] as { 'ui:order'?: string[] } | undefined) ?? {}
    const groupOrder = groupUi['ui:order'] ?? Object.keys(prop.properties)
    const calcs: Calc[] = []
    let current: Calc | null = null
    for (const innerKey of groupOrder) {
      const inner = prop.properties[innerKey]
      if (!inner) continue
      if (isCalcToggle(inner)) {
        const parsed = parseCalcTitle(inner.title!)
        current = {
          optionKey: innerKey,
          title: parsed.title,
          deprecated: parsed.deprecated,
          paths: parsed.paths,
          extras: []
        }
        calcs.push(current)
      } else if (current) {
        current.extras.push(toExtraField(innerKey, inner))
      } else {
        // Extras before any calc (rare) — drop them onto a synthetic calc
        // labelled with the group name so they still get rendered.
        current = {
          optionKey: '__group_extras__',
          title: '(group-level settings)',
          deprecated: false,
          paths: [],
          extras: [toExtraField(innerKey, inner)]
        }
        calcs.push(current)
      }
    }

    groups.push({
      name: key,
      title: (prop.title as string) ?? key,
      calcs
    })
  }

  return { globals, groups }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S: Record<string, CSSProperties> = {
  root: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#333',
    padding: '16px 0'
  },
  desc: { fontSize: 13, color: '#666', marginBottom: 12 },
  legend: {
    fontSize: 12,
    color: '#888',
    marginBottom: 14,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 14,
    alignItems: 'center'
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4 },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    background: '#fff'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    userSelect: 'none' as CSSProperties['userSelect'],
    marginBottom: 4
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#333',
    textTransform: 'capitalize'
  },
  groupCount: { fontSize: 11, color: '#888', marginLeft: 8 },
  caret: { fontSize: 12, color: '#888' },
  search: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 6,
    border: '1px solid #ccc',
    boxSizing: 'border-box' as CSSProperties['boxSizing'],
    marginBottom: 12
  },
  globalsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase' as CSSProperties['textTransform'],
    letterSpacing: '0.04em',
    marginBottom: 3,
    display: 'block',
    fontWeight: 600
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    borderRadius: 4,
    border: '1px solid #ccc',
    fontSize: 13,
    boxSizing: 'border-box' as CSSProperties['boxSizing']
  },
  calcRow: {
    padding: '8px 4px',
    borderTop: '1px solid #f0f0f0',
    display: 'flex',
    flexDirection: 'column' as CSSProperties['flexDirection'],
    gap: 4
  },
  calcRowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  toggle: {
    flexShrink: 0,
    width: 18,
    height: 18,
    cursor: 'pointer'
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#333',
    flex: 1,
    minWidth: 0
  },
  calcTitleDeprecated: {
    color: '#dc3545'
  },
  extrasToggle: {
    background: 'none',
    border: 'none',
    color: '#17a2b8',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 6px',
    textDecoration: 'underline'
  },
  pathBox: {
    background: '#f8f9fa',
    borderRadius: 4,
    padding: '6px 10px',
    marginLeft: 26
  },
  pathList: {
    margin: 0,
    padding: 0,
    listStyle: 'none' as CSSProperties['listStyle']
  },
  pathItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '1px 0',
    fontSize: 11,
    fontFamily: 'SFMono-Regular, Consolas, monospace',
    wordBreak: 'break-all' as CSSProperties['wordBreak']
  },
  statusIcon: {
    fontSize: 12,
    flexShrink: 0,
    lineHeight: 1
  },
  extrasBox: {
    background: '#f8f9fa',
    border: '1px dashed #ddd',
    borderRadius: 4,
    padding: 10,
    marginTop: 6,
    marginLeft: 26
  },
  extraField: {
    marginBottom: 8
  },
  arrayHeader: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase' as CSSProperties['textTransform'],
    letterSpacing: '0.04em',
    marginBottom: 4,
    fontWeight: 600
  },
  arrayRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'flex-end',
    flexWrap: 'wrap' as CSSProperties['flexWrap'],
    padding: '8px 0',
    borderTop: '1px dashed #e0e0e0'
  },
  arrayField: {
    flex: '1 1 110px',
    minWidth: 100
  },
  arrayAddBtn: {
    background: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 6
  },
  removeBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 34,
    padding: 0,
    background: '#fff',
    border: '1.5px solid #ef6b6b',
    borderRadius: 8,
    color: '#ef6b6b',
    cursor: 'pointer',
    flexShrink: 0
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    border: 'none',
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer'
  },
  btnSave: { background: '#28a745', color: '#fff' },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    marginTop: 14,
    position: 'sticky' as CSSProperties['position'],
    bottom: 0,
    background: '#fff',
    padding: '10px 0',
    borderTop: '1px solid #eee'
  },
  status: { fontSize: 12, minHeight: 18 },
  deprecatedBadge: {
    background: '#dc3545',
    color: '#fff',
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 3,
    marginLeft: 6,
    textTransform: 'uppercase' as CSSProperties['textTransform'],
    fontWeight: 700
  }
}

const STATUS_ICON: Record<PathStatus, string> = {
  ok: '✅',
  null: '❓',
  missing: '❌'
}
const STATUS_LABEL: Record<PathStatus, string> = {
  ok: 'has data',
  null: 'value is null',
  missing: 'not present'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  configuration?: Record<string, unknown>
  save: (cfg: Record<string, unknown>) => void
}

export default function PluginConfigurationPanel({
  configuration,
  save
}: Props): React.ReactElement {
  const [config, setConfig] = useState<Record<string, unknown>>(
    () => configuration ?? {}
  )
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [pathStatus, setPathStatus] = useState<Record<string, PathStatus>>({})
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedExtras, setExpandedExtras] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/skServer/plugins').then((r) => r.json() as Promise<PluginMeta[]>),
      fetch('/signalk/v1/api/vessels/self').then((r) => r.json())
    ])
      .then(([plugins, vessel]) => {
        const p = plugins.find((pl) => pl.id === 'derived-data')
        if (p) {
          const schema = typeof p.schema === 'function' ? p.schema() : p.schema
          const ui =
            typeof p.uiSchema === 'function' ? p.uiSchema() : (p.uiSchema ?? {})
          setCatalog(buildCatalog(schema, ui))
        }
        setPathStatus(flattenVessel(vessel))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      fetch('/signalk/v1/api/vessels/self')
        .then((r) => r.json())
        .then((vessel) => setPathStatus(flattenVessel(vessel)))
        .catch(() => {})
    }, 10000)
    return () => clearInterval(id)
  }, [])

  // Expand groups that have at least one enabled calc, the first time the
  // catalog arrives. Empty config -> all collapsed. This lets a user see at
  // a glance what is currently active without scrolling through 9 groups.
  useEffect(() => {
    if (!catalog) return
    const initiallyOpen = new Set<string>()
    for (const g of catalog.groups) {
      const groupCfg = config[g.name] as Record<string, unknown> | undefined
      if (groupCfg && g.calcs.some((c) => groupCfg[c.optionKey] === true)) {
        initiallyOpen.add(g.name)
      }
    }
    setExpandedGroups(initiallyOpen)
    // intentional: run only once when the catalog first arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog])

  const filteredGroups = useMemo(() => {
    if (!catalog) return []
    const q = search.trim().toLowerCase()
    if (!q) return catalog.groups
    return catalog.groups
      .map((g) => ({
        ...g,
        calcs: g.calcs.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.optionKey.toLowerCase().includes(q) ||
            c.paths.some((p) => p.toLowerCase().includes(q))
        )
      }))
      .filter((g) => g.calcs.length > 0)
  }, [catalog, search])

  // When the user is searching, force-expand every matching group so hits
  // are visible without an extra click per group.
  const effectiveExpanded = useMemo(() => {
    if (!search.trim()) return expandedGroups
    return new Set(filteredGroups.map((g) => g.name))
  }, [search, filteredGroups, expandedGroups])

  const toggleGroup = (name: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  const toggleExtras = (groupName: string, optionKey: string): void => {
    const id = groupName + '/' + optionKey
    setExpandedExtras((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setGlobal = (key: string, value: unknown): void => {
    setConfig((c) => ({ ...c, [key]: value }))
  }
  const setGroupValue = (
    groupName: string,
    key: string,
    value: unknown
  ): void => {
    setConfig((c) => ({
      ...c,
      [groupName]: { ...(c[groupName] as object | undefined), [key]: value }
    }))
  }
  const getGroupValue = (groupName: string, key: string): unknown => {
    const g = config[groupName] as Record<string, unknown> | undefined
    return g ? g[key] : undefined
  }

  const doSave = useCallback(() => {
    save(config)
    setStatus('Saved!')
    setTimeout(() => setStatus(''), 3000)
  }, [config, save])

  if (!catalog) {
    return (
      <div style={S.root}>
        <div style={S.desc}>Loading catalog…</div>
      </div>
    )
  }

  return (
    <div style={S.root}>
      <div style={S.desc}>
        Enable derived calculations and adjust their parameters. Each calculator
        shows the SignalK paths it consumes with live availability — a
        calculator that has missing inputs won't emit until those paths carry
        data.
      </div>

      <div style={S.legend}>
        {(['ok', 'null', 'missing'] as const).map((s) => (
          <span key={s} style={S.legendItem}>
            <span style={S.statusIcon} aria-hidden="true">
              {STATUS_ICON[s]}
            </span>{' '}
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ ...S.groupTitle, marginBottom: 10 }}>Globals</div>
        <div style={S.globalsGrid}>
          {catalog.globals.map((g) => (
            <FieldEditor
              key={g.key}
              field={g}
              value={config[g.key]}
              onChange={(v) => setGlobal(g.key, v)}
            />
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="Search calculators by name, optionKey, or path…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={S.search}
      />

      {filteredGroups.map((g) => {
        const expanded = effectiveExpanded.has(g.name)
        const enabledCount = g.calcs.filter(
          (c) => getGroupValue(g.name, c.optionKey) === true
        ).length
        return (
          <div key={g.name} style={S.card}>
            <div style={S.cardHeader} onClick={() => toggleGroup(g.name)}>
              <span>
                <span style={S.groupTitle}>{g.title}</span>
                <span style={S.groupCount}>
                  {enabledCount}/{g.calcs.length} enabled
                </span>
              </span>
              <span style={S.caret}>{expanded ? '▾' : '▸'}</span>
            </div>
            {expanded && (
              <div>
                {g.calcs.map((c) => (
                  <CalcRow
                    key={c.optionKey}
                    group={g}
                    calc={c}
                    enabled={getGroupValue(g.name, c.optionKey) === true}
                    onToggle={(v) => setGroupValue(g.name, c.optionKey, v)}
                    extrasExpanded={expandedExtras.has(
                      g.name + '/' + c.optionKey
                    )}
                    onToggleExtras={() => toggleExtras(g.name, c.optionKey)}
                    getExtra={(key) => getGroupValue(g.name, key)}
                    setExtra={(key, v) => setGroupValue(g.name, key, v)}
                    pathStatus={pathStatus}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div style={S.actions}>
        <button style={{ ...S.btn, ...S.btnSave }} onClick={doSave}>
          Save Configuration
        </button>
        {status && (
          <span style={{ ...S.status, color: '#28a745' }}>{status}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CalcRow
// ---------------------------------------------------------------------------

interface CalcRowProps {
  group: Group
  calc: Calc
  enabled: boolean
  onToggle: (v: boolean) => void
  extrasExpanded: boolean
  onToggleExtras: () => void
  getExtra: (key: string) => unknown
  setExtra: (key: string, v: unknown) => void
  pathStatus: Record<string, PathStatus>
}

function CalcRow({
  calc,
  enabled,
  onToggle,
  extrasExpanded,
  onToggleExtras,
  getExtra,
  setExtra,
  pathStatus
}: CalcRowProps): React.ReactElement {
  const hasExtras = calc.extras.length > 0
  return (
    <div style={S.calcRow}>
      <div style={S.calcRowTop}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={S.toggle}
        />
        <span
          style={{
            ...S.calcTitle,
            ...(calc.deprecated ? S.calcTitleDeprecated : {})
          }}
        >
          {calc.title}
          {calc.deprecated && <span style={S.deprecatedBadge}>deprecated</span>}
        </span>
        {hasExtras && (
          <button style={S.extrasToggle} onClick={onToggleExtras}>
            {extrasExpanded ? 'hide settings' : 'settings'}
          </button>
        )}
      </div>
      {calc.paths.length > 0 && (
        <div style={S.pathBox}>
          <ul style={S.pathList}>
            {calc.paths.map((p) => {
              const s = pathStatus[p] ?? 'missing'
              return (
                <li key={p} style={S.pathItem}>
                  <span style={S.statusIcon} title={STATUS_LABEL[s]}>
                    {STATUS_ICON[s]}
                  </span>
                  {p}
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {hasExtras && extrasExpanded && (
        <div style={S.extrasBox}>
          {calc.extras.map((f) => (
            <div key={f.key} style={S.extraField}>
              <FieldEditor
                field={f}
                value={getExtra(f.key)}
                onChange={(v) => setExtra(f.key, v)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldEditor (number, string, boolean, enum, array-of-object, fallback)
// ---------------------------------------------------------------------------

interface FieldEditorProps {
  field: ExtraField
  value: unknown
  onChange: (v: unknown) => void
}

function FieldEditor({
  field,
  value,
  onChange
}: FieldEditorProps): React.ReactElement {
  switch (field.type) {
    case 'number':
      return (
        <div>
          <label style={S.fieldLabel}>{field.title}</label>
          <input
            type="number"
            value={
              typeof value === 'number'
                ? value
                : typeof field.default === 'number'
                  ? field.default
                  : ''
            }
            onChange={(e) => {
              const v = e.target.value
              onChange(v === '' ? undefined : Number(v))
            }}
            style={S.input}
          />
          {field.description && <Description text={field.description} />}
        </div>
      )
    case 'string':
      return (
        <div>
          <label style={S.fieldLabel}>{field.title}</label>
          <input
            type="text"
            value={
              typeof value === 'string'
                ? value
                : typeof field.default === 'string'
                  ? field.default
                  : ''
            }
            onChange={(e) => onChange(e.target.value)}
            style={S.input}
          />
          {field.description && <Description text={field.description} />}
        </div>
      )
    case 'boolean':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={
              typeof value === 'boolean' ? value : Boolean(field.default)
            }
            onChange={(e) => onChange(e.target.checked)}
          />
          <label style={{ fontSize: 13 }}>{field.title}</label>
        </div>
      )
    case 'enum':
      return (
        <div>
          <label style={S.fieldLabel}>{field.title}</label>
          <select
            value={String(value ?? field.default ?? '')}
            onChange={(e) => {
              // Numeric enums survive the select via String() — coerce back.
              const opt = field.enum.find((o) => String(o) === e.target.value)
              onChange(opt)
            }}
            style={S.input}
          >
            {field.enum.map((o) => (
              <option key={String(o)} value={String(o)}>
                {String(o)}
              </option>
            ))}
          </select>
          {field.description && <Description text={field.description} />}
        </div>
      )
    case 'array-object':
      return (
        <ArrayObjectEditor
          field={field}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      )
    case 'unknown':
      return (
        <div>
          <label style={S.fieldLabel}>{field.title} (raw)</label>
          <textarea
            value={JSON.stringify(value ?? field.default ?? null, null, 2)}
            onChange={(e) => {
              try {
                onChange(JSON.parse(e.target.value))
              } catch {
                /* swallow — user is mid-typing */
              }
            }}
            style={{ ...S.input, fontFamily: 'monospace', minHeight: 80 }}
          />
        </div>
      )
  }
}

function Description({ text }: { text: string }): React.ReactElement {
  return (
    <div style={{ fontSize: 11, color: '#888', marginTop: 2, lineHeight: 1.3 }}>
      {text}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ArrayObjectEditor — rows of fields with add/remove
//
// Handles the schema-array case (cpa_tcpa notification zones, tankVolume
// calibrations): items are objects whose property schemas dictate the
// per-row fields. Each row gets its own delete button so users can prune
// a zone without rewriting the JSON.
// ---------------------------------------------------------------------------

interface ArrayObjectEditorProps {
  field: ArrayObjectField
  value: Array<Record<string, unknown>>
  onChange: (v: Array<Record<string, unknown>>) => void
}

function ArrayObjectEditor({
  field,
  value,
  onChange
}: ArrayObjectEditorProps): React.ReactElement {
  const defaultsRow = useMemo<Record<string, unknown>>(() => {
    const row: Record<string, unknown> = {}
    for (const f of field.itemFields) {
      if (f.default !== undefined) row[f.key] = f.default
    }
    return row
  }, [field.itemFields])

  const setField = (i: number, key: string, v: unknown): void => {
    onChange(value.map((row, j) => (j === i ? { ...row, [key]: v } : row)))
  }
  const remove = (i: number): void => onChange(value.filter((_, j) => j !== i))
  const add = (): void => onChange([...value, { ...defaultsRow }])

  return (
    <div>
      <div style={S.arrayHeader}>{field.title}</div>
      {field.description && <Description text={field.description} />}
      {value.map((row, i) => (
        <div key={i} style={S.arrayRow}>
          {field.itemFields.map((f) => (
            <div key={f.key} style={S.arrayField}>
              <FieldEditor
                field={f}
                value={row[f.key]}
                onChange={(v) => setField(i, f.key, v)}
              />
            </div>
          ))}
          <button
            style={S.removeBtn}
            onClick={() => remove(i)}
            title="Remove row"
            aria-label="Remove row"
          >
            <TrashIcon />
          </button>
        </div>
      ))}
      <button style={S.arrayAddBtn} onClick={add}>
        + Add row
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function TrashIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Vessel-tree helpers
// ---------------------------------------------------------------------------

function flattenVessel(
  obj: unknown,
  prefix?: string
): Record<string, PathStatus> {
  const result: Record<string, PathStatus> = {}
  if (!obj || typeof obj !== 'object') return result
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key
    const val = (obj as Record<string, unknown>)[key]
    if (val && typeof val === 'object' && 'value' in val) {
      const v = (val as { value: unknown }).value
      result[fullPath] = v === null ? 'null' : 'ok'
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenVessel(val, fullPath))
    }
  }
  return result
}
