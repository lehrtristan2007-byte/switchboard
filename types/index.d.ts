declare module 'claude-code' {
  interface PluginState {
    // off: Mods, die der Nutzer ausgeschaltet hat (Name aus der plugin.json).
    // hidden: Mods, deren zusätzliche Panels ausgeblendet sind.
    // rev: Zähler, der die Schalttafel neu zeichnen lässt.
    switchboard: {
      off: Shaped<string[]>
      hidden: Shaped<string[]>
      rev: number
    }
  }
}
