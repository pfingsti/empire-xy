# Empire XY

Echtzeitstrategie durch fünf Epochen, inspiriert von Empire Earth und Age of Empires. Alle Grafiken werden im Code gezeichnet, es werden keine Inhalte der Originalspiele verwendet.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/registry.js` | Baustein-System: sammelt alle Bausteine und setzt vor jedem Spiel die Inhalte zusammen |
| `src/modules/` | Kern-Bausteine: Rohstoffe, Epochen, Einheiten, Gebäude, Forschung |
| `mods/` | Beispiel-Bausteine (Helden, Atomzeitalter), im Hauptmenü zuschaltbar |
| `src/engine.js` | Spiel-Engine: Karte, Wegfindung, Kampf, KI, Grafik, Bedienung |
| `src/boot.js` | Baustein-Verwaltung im Hauptmenü, Anbindung an die Desktop-App |
| `desktop/` | Electron-App mit Update-Watcher und Bausteine-Ordner |
| `build.js` | erzeugt `index.html` (Browser) und `desktop/app/index.html` (Desktop) |

## Eigenen Baustein schreiben

Ein Baustein ist eine `.js`-Datei, die `EmpireXY.register({...})` aufruft. Er kann Einheiten, Gebäude, Epochen, Forschungen und Spielregeln hinzufügen oder bestehende Werte über `patch()` ändern.

```js
EmpireXY.register({
  id: 'bogenturm', name: 'Bogenturm', version: '1.0.0',
  description: 'Ein günstiger Holzturm ab der Steinzeit.',
  buildings: {
    bogenturm: { name: 'Bogenturm', size: 2, hp: 400, cost: { wood: 120 }, time: 20,
                 atk: 5, range: 6, rate: 1.4, sight: 8, desc: 'Schießt Pfeile.', ai: { minWorkers: 10 } },
  },
  units: {
    spaeher: { label: 'Späher', from: 'barracks', names: ['Läufer'], hp: 40, atk: 2, range: .5, rate: 1,
               speed: 3, sight: 10, cost: { food: 40 }, time: 8, r: .25, pop: 1, desc: 'Schnell, sieht weit.' },
  },
  techs: {
    feuerpfeile: { name: 'Feuerpfeile', at: 'range', epoch: 1, cost: { wood: 100, gold: 50 }, time: 25,
                   effect: { atk: { ranged: .1 } }, desc: 'Fernkampf: Angriff +10 %.' },
  },
  patch(xy) { xy.units.worker.speed *= 1.1; },
  hooks: { tick(api, dt) {}, start(api) {} },
});
```

Laden: im Browser über „Baustein laden“ im Hauptmenü. In der Desktop-App liegt die Datei im Bausteine-Ordner (Knopf „Bausteine-Ordner öffnen“). Neue Dateien dort werden automatisch erkannt.

## Desktop-App und Updates

- Installer bauen: `cd desktop && npm install && npm run dist` (unter Linux wird dafür Wine gebraucht).
- Update-Watcher: Die App prüft beim Start und danach alle 30 Minuten die GitHub Releases von `pfingsti/empire-xy`. Neue Versionen werden im Hintergrund geladen und beim nächsten Neustart installiert.
- Weil das Repository privat ist, braucht die App einen Lese-Schlüssel. Lege auf GitHub einen fine-grained Token mit nur „Contents: read“ für dieses Repository an und speichere ihn als Repository-Secret `UPDATE_READ_TOKEN`. Der Release-Workflow schreibt ihn beim Bauen in die App.
- Neue Version veröffentlichen: in `desktop/package.json` die Version erhöhen, committen, Tag setzen (`git tag v1.0.1 && git push --tags`). GitHub baut und veröffentlicht den Installer, alle installierten Spiele aktualisieren sich danach selbst.

## Steam

Steam-Fassung bauen: `cd desktop && npm install && npm run dist:steam` (ohne Installer und GitHub-Updates, mit Errungenschaften, Steam Cloud und Overlay). Alles Weitere, auch Store-Texte, Grafiken und Upload per SteamPipe: [steam/STEAM.md](steam/STEAM.md).
