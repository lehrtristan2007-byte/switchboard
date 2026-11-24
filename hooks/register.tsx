import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

// Switchboard: eine Schalttafel für alle Mods.
//   /switchboard öffnet sie (/mods ist vom Mod Store belegt).
// Jede Zeile ist ein Mod: links Symbol, Name, Beschreibung und der Befehl,
// rechts ein Auge und ein Schalter.
//   Schalter  schaltet den Mod ab. Sofort verschwindet seine Anzeige, beim
//             nächsten Laden (neue Sitzung oder /reload-plugins) wird er
//             ganz abgewiesen und läuft nicht mehr.
//   Auge      blendet die Panels und Bänder des Mods aus, ohne ihn abzuschalten.
//             Es erscheint nur bei Mods, die überhaupt etwas anzeigen.
// Neue Mods tauchen von selbst auf: Die Liste kommt aus den Einstellungen und
// aus jedem Mod, der geladen wird. Der Mod nutzt keine KI und kostet nichts.

const PANE = 'switchboard'
const SELF = 'switchboard'
const LANG: 'de' | 'en' = 'de'

const GREEN = '#22c55e'
const GRAY = '#9ca3af'

const T = {
  de: {
    title: 'Switchboard',
    running: (n: number) => `${n} Mods laufen`,
    off: (n: number) => `${n} aus`,
    pending: 'aus ab dem nächsten Laden',
    none: 'Keine weiteren Mods gefunden.',
    opened: 'Switchboard geöffnet.',
    hiddenPane: 'Dieses Panel ist in der Schalttafel ausgeblendet.',
    refused: 'Switchboard: ausgeschaltet',
    toOpen: (cmd: string) => `${cmd} zum Öffnen`,
    footer: 'Der Schalter wirkt sofort auf die Anzeige und ganz beim nächsten Laden.',
    eyeOn: 'Panels sichtbar',
    eyeOff: 'Panels versteckt',
    self: 'Diese Schalttafel schaltet sich nie selbst ab.',
  },
  en: {
    title: 'Switchboard',
    running: (n: number) => `${n} mods running`,
    off: (n: number) => `${n} off`,
    pending: 'off from the next load',
    none: 'No other mods found.',
    opened: 'Switchboard opened.',
    hiddenPane: 'This panel is hidden in the switchboard.',
    refused: 'Switchboard: switched off',
    toOpen: (cmd: string) => `${cmd} to open`,
    footer: 'The switch hides the mod now and stops it fully on the next load.',
    eyeOn: 'Panels shown',
    eyeOff: 'Panels hidden',
    self: 'This switchboard never switches itself off.',
  },
}[LANG]

type Info = {
  description?: string
  command?: string
  hasPanel: boolean
  isMod: boolean
}
type Seen = { name: string; version?: string; isMod: boolean }

const off = atom({ plugin: 'switchboard', key: 'off' } as const, [], {
  shape: 'off-1',
})
const hidden = atom({ plugin: 'switchboard', key: 'hidden' } as const, [], {
  shape: 'hidden-1',
})
const rev = atom({ plugin: 'switchboard', key: 'rev' } as const, 0)

// "name@marketplace" aus enabledPlugins wird zum Namen aus der plugin.json.
const nameOf = (key: string): string => {
  const at = key.lastIndexOf('@')

  return at > 0 ? key.slice(0, at) : key
}

const toggle = (list: readonly string[], name: string): string[] =>
  list.includes(name) ? list.filter(one => one !== name) : [...list, name]

// "savvy-progress" wird zu "Savvy Progress".
const titleOf = (name: string): string =>
  name
    .split(/[-_]/)
    .filter(part => part !== '')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const ICONS: [RegExp, string][] = [
  [/cache|clock|time|usage|meter/, '◷'],
  [/progress|flow|agent|helper|desk|swarm/, '⇅'],
  [/secret|protect|security|guard|net|screen|share/, '◈'],
  [/brain|dump|think|note|reflect|memory/, '✎'],
  [/theme|snow|look|color/, '❄'],
  [/replay|compact|handoff|refresh/, '↻'],
  [/inventory|tray|store|list/, '▤'],
  [/context|gauge|bar|band/, '▥'],
]

const iconOf = (name: string): string => {
  const lower = name.toLowerCase()
  for (const [pattern, icon] of ICONS) {
    if (pattern.test(lower)) {
      return icon
    }
  }

  return '◆'
}

// Was beim Laden gemeldet wurde und was aus den Dateien der Mods gelesen wurde.
// Die Variablen leben nur bis zum Neuladen des Mods.
const seen = new Map<string, Seen>()
const infos = new Map<string, Info>()
let offCache: string[] = []
let isInfoLoaded = false

async function loadList($: any, key: string): Promise<string[]> {
  try {
    const value = await $.store.get(key)

    return Array.isArray(value) ? value.filter(x => typeof x === 'string') : []
  } catch {
    return key === 'off' ? offCache : []
  }
}

async function enabledNames($: any): Promise<string[]> {
  try {
    const value = await $.settings.read({ key: 'enabledPlugins' })
    if (value === null || typeof value !== 'object') {
      return []
    }

    return Object.entries(value as Record<string, unknown>)
      .filter(([, isOn]) => isOn !== false)
      .map(([key]) => nameOf(key))
  } catch {
    return []
  }
}

// Beschreibung, Befehl und Panel-Hinweis eines Mods aus seinen Dateien.
async function readInfo($: any, dir: string): Promise<Info | undefined> {
  try {
    const manifest = JSON.parse(await $.fs.read(`${dir}/.claude-plugin/plugin.json`))
    let command: string | undefined
    let hasPanel = false
    let isMod = false
    try {
      const hooks = JSON.parse(await $.fs.read(`${dir}/hooks/hooks.json`))
      isMod = Array.isArray(hooks.modules) && hooks.modules.length > 0
      for (const file of hooks.modules ?? []) {
        const source: string = await $.fs.read(`${dir}/hooks/${String(file).replace(/^\.\//, '')}`)
        hasPanel =
          hasPanel ||
          /ui\.open|component:\s*['"](Pane|AbovePrompt|Placed|Backdrop)['"]|\$\.theme\.set/.test(
            source,
          )
        const match = /command\.register\(\s*\{\s*name:\s*['"]([\w:-]+)['"]/.exec(source)
        if (match !== null) {
          command = `/${match[1]}`
        }
      }
    } catch {
      // Mod ohne Hooks-Modul: keine Panels.
    }

    return {
      description: typeof manifest.description === 'string' ? manifest.description : undefined,
      command,
      hasPanel,
      isMod,
    }
  } catch {
    return undefined
  }
}

// Alle installierten Mods einmal aus installed_plugins.json lesen.
async function loadInfos($: any, root: string): Promise<void> {
  if (isInfoLoaded) {
    return
  }
  isInfoLoaded = true
  // Der Konfigurationsordner steht im Pfad dieses Mods, sonst in den
  // Umgebungsvariablen.
  const at = root.indexOf('.claude')
  let configDir = at >= 0 ? root.slice(0, at + '.claude'.length) : ''
  if (configDir === '') {
    const custom = await $.env.get('CLAUDE_CONFIG_DIR')
    const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
    configDir = custom ?? (home === undefined ? '' : `${home}/.claude`)
  }
  if (configDir === '') {
    return
  }
  try {
    const file = JSON.parse(await $.fs.read(`${configDir}/plugins/installed_plugins.json`))
    const plugins: Record<string, any> = file.plugins ?? file
    for (const [key, entries] of Object.entries(plugins)) {
      const entry = Array.isArray(entries) ? entries[0] : entries
      const dir: unknown = entry?.installPath
      if (typeof dir !== 'string') {
        continue
      }
      const info = await readInfo($, dir)
      if (info !== undefined) {
        infos.set(nameOf(key), info)
      }
    }
  } catch {
    // Ohne diese Datei bleibt die Liste ohne Beschreibungen.
  }
}

async function flip($: any, key: 'off' | 'hidden', name: string): Promise<void> {
  const list = key === 'off' ? await read($, off) : await read($, hidden)
  const next = toggle(list, name)
  await $.store.set(key, next)
  if (key === 'off') {
    offCache = next
    await update($, off, () => next)
  } else {
    await update($, hidden, () => next)
  }
  await update($, rev, n => n + 1)
}

export const register: Register = on => {
  // Jeder Mod wird gemeldet, bevor er lädt: merken, und abweisen, wenn er in
  // der Schalttafel ausgeschaltet ist. Die Schalttafel selbst bleibt immer an.
  on('plugin.register', async ($, e, next) => {
    seen.set(e.name, {
      name: e.name,
      version: e.version,
      isMod: e.provides.modules.length > 0,
    })
    if (e.name === SELF) {
      return next(e)
    }
    offCache = await loadList($, 'off')
    if (offCache.includes(e.name)) {
      return { refuse: T.refused }
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : { allow: true }))

  on('session.start', async ($, e, next) => {
    const storedOff = await loadList($, 'off')
    const storedHidden = await loadList($, 'hidden')
    await update($, off, () => storedOff)
    await update($, hidden, () => storedHidden)
    await $.command.register({
      name: 'switchboard',
      description: 'Schalttafel: alle Mods sehen, ein- und ausschalten',
    })

    return next(e)
  })

  on('command.run', { command: 'switchboard' }, async $ => {
    await $.ui.open({ id: PANE, title: T.title })

    return { text: T.opened }
  })

  // Die Schalttafel selbst.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    await read($, rev)
    const offList = await read($, off)
    const hiddenList = await read($, hidden)
    await loadInfos($, $.plugin.root)

    // Nur Mods: Plugins mit einem Hooks-Modul. Reine Skill-Sammlungen und
    // Plugins ohne Modul bleiben draußen, sonst wird die Liste unbrauchbar lang.
    const isModName = (name: string): boolean =>
      seen.get(name)?.isMod === true || infos.get(name)?.isMod === true
    const names = new Set<string>()
    for (const name of [...seen.keys(), ...(await enabledNames($))]) {
      if (isModName(name)) {
        names.add(name)
      }
    }
    for (const name of offList) {
      names.add(name)
    }
    names.delete(SELF)
    const rows = [...names].sort((a, b) => a.localeCompare(b))
    const offCount = rows.filter(name => offList.includes(name)).length

    return (
      <Box
        flexDirection="column"
        gap={1}
        borderStyle="round"
        borderColor={GRAY}
        paddingX={2}
        paddingY={1}
      >
        <Box flexDirection="column">
          <Text bold>{T.title}</Text>
          <Text dimColor>
            {T.running(rows.length - offCount)}, {T.off(offCount)}
          </Text>
        </Box>
        {rows.length === 0 && <Text dimColor>{T.none}</Text>}
        {rows.map(name => {
          const isOff = offList.includes(name)
          const isHidden = hiddenList.includes(name)
          const info = infos.get(name)
          const isStillLoaded = isOff && seen.has(name)
          const hasPanel = info === undefined ? true : info.hasPanel

          return (
            <Box
              key={`mod:${name}`}
              justifyContent="space-between"
              alignItems="center"
              gap={2}
            >
              <Box gap={2}>
                <Text dimColor>{iconOf(name)}</Text>
                <Box flexDirection="column">
                  <Text bold dimColor={isOff}>
                    {titleOf(name)}
                  </Text>
                  {info?.description !== undefined && (
                    <Text dimColor maxLines={2}>
                      {info.description}
                    </Text>
                  )}
                  {info?.command !== undefined && (
                    <Text italic dimColor>
                      {T.toOpen(info.command)}
                    </Text>
                  )}
                  {isStillLoaded && <Text color="#f59e0b">{T.pending}</Text>}
                </Box>
              </Box>
              <Box gap={1} alignItems="center">
                {hasPanel && (
                  <Button
                    key={`panels:${name}`}
                    label={isHidden ? T.eyeOff : T.eyeOn}
                    dimColor={isHidden}
                    onPress={() => flip($, 'hidden', name)}
                  >
                    <Text dimColor={isHidden}>{isHidden ? '◌' : '◉'}</Text>
                  </Button>
                )}
                <Button
                  key={`off:${name}`}
                  label={isOff ? 'Aus' : 'An'}
                  onPress={() => flip($, 'off', name)}
                >
                  <Text backgroundColor={isOff ? GRAY : GREEN} color="#ffffff">
                    {isOff ? ' ●    ' : '    ● '}
                  </Text>
                </Button>
              </Box>
            </Box>
          )
        })}
        <Box flexDirection="column">
          <Text dimColor>{T.footer}</Text>
          <Text dimColor>{T.self}</Text>
        </Box>
      </Box>
    )
  })

  // Panels anderer Mods: ausgeblendet, solange der Mod ausgeschaltet ist oder
  // seine Panels versteckt sind.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId === PANE || e.plugin === undefined || e.plugin === SELF) {
      return next(e)
    }
    const names = [...(await read($, off)), ...(await read($, hidden))]
    if (!names.includes(e.plugin)) {
      return next(e)
    }
    const { Text } = $.ui.resolve(e)

    return <Text dimColor>{T.hiddenPane}</Text>
  })

  // Das Band über dem Eingabefeld: Zeilen ausgeschalteter oder versteckter
  // Mods fallen heraus.
  on('ui.render', { component: 'AbovePromptList' }, async ($, e, next) => {
    const names = [...(await read($, off)), ...(await read($, hidden))]
    if (names.length === 0) {
      return next(e)
    }

    return next({
      ...e,
      props: {
        ...e.props,
        rows: e.props.rows.filter(row => !names.includes(row.plugin)),
      },
    })
  })
}
