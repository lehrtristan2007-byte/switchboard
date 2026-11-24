# Switchboard

Eine Schalttafel für alle Mods in Claude Code. Mit `/switchboard` öffnen Sie eine Karte mit jedem Mod, der bei Ihnen läuft, schalten ihn ein oder aus und blenden seine Zusatz-Panels aus. Neue Mods erscheinen von selbst in der Liste. Der Mod nutzt keine KI und kostet nichts.

Er ist ein Nachbau von Mod 9 aus dem Video "9 Insane Claude Mods I Already Can't live Without" von Ben AI, nach der Beschreibung im Video und einem Bild der Schalttafel. Er ist kein Original des Autors und nicht von ihm.

## Was er kann

- Die Karte zeigt je Mod Symbol, Name, Beschreibung und den Befehl zum Öffnen. Namen, Beschreibung und Befehl liest der Mod aus den Dateien des jeweiligen Mods.
- Aufgeführt werden nur Mods, also Plugins mit einem Hooks-Modul. Reine Skill-Sammlungen bleiben draußen, damit die Liste kurz bleibt.
- Der Schalter blendet die Anzeige eines Mods sofort aus und weist ihn beim nächsten Laden (neue Sitzung oder `/reload-plugins`) ganz ab. Der Zustand bleibt über Sitzungen erhalten.
- Das Auge blendet nur die Panels und Bänder eines Mods aus, der Mod läuft weiter. Es erscheint nur bei Mods, die etwas anzeigen.
- Die Schalttafel schaltet sich nie selbst ab.

## Installieren

In einer Terminal-Sitzung von Claude Code:

```
/plugin install switchboard --marketplace lehrtristan2007-byte/switchboard
```

Aus einer Shell:

```
claude plugin install switchboard --marketplace lehrtristan2007-byte/switchboard
```

In der Desktop-App, wo `/plugin` nicht läuft: Klick auf `+` neben dem Eingabefeld, dann Plugins, Add marketplace mit `lehrtristan2007-byte/switchboard`, dann Add plugin.

Danach öffnet `/switchboard` die Schalttafel. Der Befehl heißt so, weil `/mods` bei vielen Installationen schon belegt ist.

## Grenzen

- Ganz abgeschaltet wird ein Mod erst beim nächsten Laden. Ein laufender Mod lässt sich mitten im Chat nicht vollständig stoppen, nur seine Anzeige wird sofort ausgeblendet.
- Die Oberfläche der Mods kennt nur Boxen, Text und Knöpfe. Symbole sind deshalb Zeichen und der Schalter ein farbiger Block statt eines runden Schiebers.
- Die Oberfläche ist auf Deutsch. Mit der Konstante `LANG` oben in `hooks/register.tsx` lässt sie sich auf Englisch umstellen.
- Die Mod-Schnittstelle von Claude Code ist früh und kann sich ändern.

## Prüfen

```
claude plugin validate .
claude plugin test .
```

## Lizenz

MIT, siehe `LICENSE`.
