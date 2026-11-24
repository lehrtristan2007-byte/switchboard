import { expect, test } from 'claude-code/testing'

// Dateien der Mods, wie sie auf der Platte liegen: zwei Mods und ein Plugin
// ohne Hooks-Modul (nur Skills).
const INSTALLED = JSON.stringify({
  plugins: {
    'savvy-progress@claude-kit': [{ installPath: 'C:/m/savvy' }],
    'snowfall-theme@snowfall': [{ installPath: 'C:/m/snow' }],
    'big-skills@market': [{ installPath: 'C:/m/skills' }],
  },
})

const FILES: Record<string, string> = {
  'C:/m/savvy/.claude-plugin/plugin.json': '{"description":"Fortschrittsbalken"}',
  'C:/m/savvy/hooks/hooks.json': '{"modules":["./register.tsx"]}',
  'C:/m/savvy/hooks/register.tsx': "ui.open({ id: 'x' })",
  'C:/m/snow/.claude-plugin/plugin.json': '{"description":"Winternacht"}',
  'C:/m/snow/hooks/hooks.json': '{"modules":["./register.tsx"]}',
  'C:/m/snow/hooks/register.tsx': '$.theme.set({})',
  'C:/m/skills/.claude-plugin/plugin.json': '{"description":"Viele Skills"}',
}

// Die Liste der installierten Mods liegt im Konfigurationsordner des jeweiligen
// Rechners, ihr Pfad wird deshalb am Ende verglichen.
const fileAt = (path: string): string | undefined => {
  const normal = path.split('\\').join('/')

  return normal.endsWith('/plugins/installed_plugins.json')
    ? INSTALLED
    : FILES[normal]
}

const PANE = {
  plugin: 'switchboard',
  component: 'Pane',
  requestId: 'switchboard',
  props: {
    title: 'Switchboard',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('die Schalttafel listet die Mods aus den Einstellungen', async ($, on) => {
  on('settings.read', () => ({
    value: {
      enabledPlugins: {
        'savvy-progress@claude-kit': true,
        'snowfall-theme@snowfall': true,
        'big-skills@market': true,
      },
    },
  }))
  on('store.get', () => ({ value: undefined }))
  on('fs.read', (_, e) => {
    const text = fileAt(String(e.path))
    if (text === undefined) {
      throw new Error('missing ' + String(e.path))
    }

    return { value: text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: /Savvy Progress/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Snowfall Theme/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /2 Mods laufen/ })).toBeDefined()
    // Ein Plugin ohne Hooks-Modul ist kein Mod und bleibt draußen.
    expect(await ui.find({ type: 'Text', text: /Big Skills/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('Aus schaltet einen Mod ab und merkt es sich', async ($, on) => {
  const stored: Record<string, unknown> = {}
  on('settings.read', () => ({
    value: { enabledPlugins: { 'savvy-progress@claude-kit': true } },
  }))
  on('fs.read', (_, e) => {
    const text = fileAt(String(e.path))
    if (text === undefined) {
      throw new Error('missing ' + String(e.path))
    }

    return { value: text }
  })
  on('store.get', (_, e) => ({ value: stored[e.key] }))
  on('store.set', (_, e) => {
    stored[e.key] = e.value

    return { value: undefined }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ plugin: 'switchboard', key: 'off:savvy-progress' })

  expect(stored.off).toEqual(['savvy-progress'])
  expect(await ui.find({ type: 'Text', text: /1 aus/ })).toBeDefined()
  await ui.unmount()
})
