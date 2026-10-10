# Empire XY auf Steam

Alles, was für die Veröffentlichung auf Steam gebraucht wird: Technik, Grafiken, Texte, Errungenschaften und Upload.
Stand: Oktober 2026, Spielversion 1.0.2.

## 1. Fahrplan

1. **Steam Direct**: Partner-Konto auf <https://partner.steamgames.com> anlegen, Steuer- und Bankdaten eintragen, App-Gebühr (100 US-$, wird ab 1000 $ Umsatz zurückerstattet) bezahlen. Danach gibt es eine **App-ID** und eine **Depot-ID**.
2. App-ID eintragen: in `desktop/package.json` bei `steamAppId` (jetzt `480`, das ist Valves Testspiel „Spacewar“) und in `steam/steampipe/app_build.vdf` + `depot_build.vdf` (`480` / `481` ersetzen).
3. In Steamworks einrichten (Abschnitte 4 und 5): Errungenschaften, Steam Cloud, Store-Seite, Grafiken, Systemanforderungen, IARC-Fragebogen.
4. Bauen und hochladen: `steam/steampipe/upload.bat STEAM_LOGIN` (Abschnitt 6).
5. In Steamworks unter „SteamPipe → Builds“ den Build auf den Zweig `default` setzen, „Release Options“ prüfen lassen. Valve prüft Store-Seite und Build (je etwa 3–5 Werktage). Die Store-Seite muss mindestens **2 Wochen** als „Demnächst erhältlich“ sichtbar sein, bevor das Spiel erscheinen darf.

## 2. Was im Spiel schon eingebaut ist

| Teil | Datei | Was es tut |
|---|---|---|
| steamworks.js 0.4.0 | `desktop/steam.js` | verbindet sich beim Start mit dem Steam-Client. Läuft Steam nicht, startet das Spiel trotzdem normal. |
| Overlay | `desktop/steam.js` (`electronEnableSteamOverlay`) | Umschalt+Tab öffnet das Steam-Overlay. |
| Neustart über Steam | `desktop/steam.js` (`restartAppIfNecessary`) | wird die EXE direkt gestartet, startet Steam das Spiel neu (nur mit echter App-ID). |
| Errungenschaften | `src/modules/kern-erfolge.js` → `desktop/preload.js` → `desktop/steam.js` | jede im Spiel freigeschaltete Errungenschaft wird an Steam gemeldet, auch frühere beim nächsten Start. |
| Steam Cloud | `desktop/preload.js` | Autosave, Speicherplätze 1–3 und Errungenschaften werden alle 10 s und beim Beenden hochgeladen. Beim Start gewinnt der neuere Spielstand (Zeitstempel). |
| eigene Steam-Fassung | `desktop/electron-builder.steam.js` | `npm run dist:steam` baut ohne Installer, ohne GitHub-Update-Watcher, ohne Update-Schlüssel, nur 64 Bit. Ergebnis: `release/steam/win-unpacked/`. |

Die normale Fassung (`npm run dist`, NSIS-Installer mit GitHub-Updates) bleibt unverändert, Steam ist dort ausgeschaltet.

**Testen ohne eigene App-ID:** Steam starten, dann `cd desktop && set EMPIRE_XY_STEAM=1 && npm start`. Das Spiel meldet sich als „Spacewar“ (App 480) an, das Overlay funktioniert. Errungenschaften gibt es bei Spacewar nicht unter unseren Namen; die Meldung an Steam schlägt dann still fehl, das ist in Ordnung.

## 3. Technische Anforderungen

### 64 Bit
- Electron 33 baut auf 64-Bit-Windows standardmäßig x64. Ab jetzt ist das fest eingestellt (`--x64` im Skript, `arch: ["x64"]` in der Konfiguration), die Steam-Fassung baut ausschließlich x64.
- Geprüft am 10.10.2026: `npm run dist:steam` erzeugt `Empire XY.exe` mit PE-Kennung x64 (0x8664), 280 MB entpackt, ohne Update-Schlüssel.
- steamworks.js bringt `steam_api64.dll` mit; die Steam-Konfiguration legt sie zusätzlich neben `Empire XY.exe`.
- Prüfen nach dem Bauen: Rechtsklick auf `release/steam/win-unpacked/Empire XY.exe` → Eigenschaften → Kompatibilität. Ein 64-Bit-Programm bietet dort kein „Windows 95“ an. Oder im Task-Manager: bei 32-Bit-Programmen steht „(32 Bit)“ hinter dem Namen.

### Startoption in Steamworks („Installation → Allgemein → Startoptionen“)
- Ausführbare Datei: `Empire XY.exe`
- Betriebssystem: Windows, Architektur: 64 Bit

### Steam Cloud („Anwendung → Steam Cloud“)
- Bytes pro Nutzer: **20 MB**, Dateien pro Nutzer: **20**
- Kein Auto-Cloud nötig, das Spiel nutzt die Steam-Cloud-Schnittstelle (ISteamRemoteStorage) selbst.
- Dateinamen in der Cloud: `empire-xy.spielstand.json`, `empire-xy.spielstand.platz1.json` bis `platz3`, `empire-xy.erfolge.json`.

### Systemanforderungen (für die Store-Seite)

| | Mindestens | Empfohlen |
|---|---|---|
| Betriebssystem | Windows 10 64 Bit | Windows 10/11 64 Bit |
| Prozessor | Dual-Core 2,0 GHz | Quad-Core 3,0 GHz |
| Arbeitsspeicher | 4 GB RAM | 8 GB RAM |
| Grafik | DirectX-11-fähig, 1 GB VRAM (Intel HD 620 oder besser) | DirectX 11, 2 GB VRAM (GTX 960 / RX 560 oder besser) |
| Speicherplatz | 500 MB | 500 MB |
| Bildschirm | 1280 × 720 | 1920 × 1080 |
| Sonstiges | keine Internetverbindung nötig | |

English:
- **Minimum:** Windows 10 64-bit · Dual-core 2.0 GHz · 4 GB RAM · DirectX 11 GPU with 1 GB VRAM (Intel HD 620 or better) · 500 MB storage · 1280×720 display · No internet connection required
- **Recommended:** Windows 10/11 64-bit · Quad-core 3.0 GHz · 8 GB RAM · DirectX 11 GPU with 2 GB VRAM (GTX 960 / RX 560 or better) · 500 MB storage · 1920×1080 display

Die Werte sind geschätzt (Electron-App mit Canvas-Grafik, keine Messung auf schwacher Hardware). Vor dem Eintragen einmal auf einem älteren Laptop eine 40-Minuten-Partie spielen.

### IARC-Altersfreigabe (Fragebogen in Steamworks unter „Store-Seite → Altersfreigaben“)
Der IARC-Fragebogen ist kostenlos und liefert USK, PEGI, ESRB usw. auf einmal. Antworten für Empire XY:

| Frage | Antwort |
|---|---|
| Gewalt | Ja: stilisierte Gewalt gegen menschliche Figuren aus der Vogelperspektive, kleine Figuren, kein Blut, keine Verstümmelung, keine Gewalt gegen Wehrlose als Spielziel |
| Blut / Gore | Nein |
| Sexuelle Inhalte, Nacktheit | Nein |
| Grobe Sprache | Nein |
| Drogen, Alkohol, Tabak | Nein (Bäckerei/Mühle sind Produktionsketten, kein Alkohol) |
| Glücksspiel, simuliertes Glücksspiel | Nein |
| Angst / Horror | Nein (Katastrophen wie Tsunami als Spielereignis, nicht verstörend) |
| Diskriminierung | Nein |
| Nutzer-Interaktion / Chat | Nein (kein Mehrspieler) |
| Käufe im Spiel | Nein |
| Weitergabe von Standort/Daten | Nein |
| Nutzergenerierte Inhalte | Ja, eingeschränkt: Bausteine (Mods) lädt der Spieler selbst als Datei, sie werden nicht im Spiel geteilt |

Erwartetes Ergebnis: **USK 12 / PEGI 7–12 / ESRB E10+**. Steam fragt zusätzlich die „Content Survey“ ab: dort „Häufige Gewalt oder Blut“ = nein, „Allgemeine erwachsene Inhalte“ = nein, Hinweis: „Stilisierte Kampfhandlungen mit kleinen Figuren“.

### KI-Hinweis (Pflicht seit 2024)
Steam fragt, ob KI bei der Entwicklung verwendet wurde. Empire XY ist mit Hilfe von Claude (KI) programmiert worden, die Grafiken werden im Code gezeichnet. Das muss im Abschnitt „AI Generated Content Disclosure“ angegeben werden („Pre-Generated: Code und Grafiken wurden mit KI-Unterstützung erstellt“). Laufzeit-KI-Inhalte gibt es keine.

## 4. Store-Grafiken

Entwürfe liegen in `steam/assets/`. Sie sind aus echten Spielszenen gerendert und mit Titel versehen. Für den Start reichen sie, schöner wird es mit gezeichneter Titelgrafik.

| Grafik | Größe | Datei | Pflicht |
|---|---|---|---|
| Header Capsule | 920 × 430 | `capsules/header_capsule_920x430.png` | ja |
| Small Capsule | 462 × 174 | `capsules/small_capsule_462x174.png` | ja |
| Main Capsule | 1232 × 706 | `capsules/main_capsule_1232x706.png` | ja |
| Vertical Capsule | 748 × 896 | `capsules/vertical_capsule_748x896.png` | ja |
| Bibliothek: Capsule | 600 × 900 | `capsules/library_capsule_600x900.png` | ja |
| Bibliothek: Hero (ohne Text) | 3840 × 1240 | `capsules/library_hero_3840x1240.jpg` | ja |
| Bibliothek: Logo (transparent) | 1280 × 720 | `capsules/library_logo_1280x720.png` | ja |
| Seitenhintergrund | 1438 × 810 | `capsules/page_background_1438x810.jpg` | nein |
| Screenshots (mind. 5, 16:9) | 1920 × 1080 | `screenshots/screenshot_1–5.jpg` | ja |
| Errungenschafts-Symbole | 256 × 256 JPG | `achievements/ACH_*.jpg` + `_locked.jpg` | ja, je Errungenschaft |
| Trailer | 1920 × 1080, MP4 | fehlt noch | nein, aber dringend empfohlen |
| Community-Symbol | 184 × 184 JPG | `capsules/community_icon_184x184.jpg` | ja |
| Client-Symbol | ICO (16–256 px) | `capsules/client_icon.ico` | ja |

Hinweise von Valve: Auf Capsules nur Spielname und Grafik, keine Preise, Rabatte oder Zitate. Die Größen oben sind die aktuellen (seit 2024); ältere Angaben wie 460 × 215 / 231 × 87 / 616 × 353 gelten nicht mehr.

Screenshots: 1 Mittelalter-Stadt, 2 Weltkriegszeit-Stadt, 3 Schlacht in der Eisenzeit, 4 Steinzeit-Start, 5 Forschungsfenster. Besser wären noch: Seeschlacht, Weltwunder, Diplomatie-Fenster, Bausteine-Menü.

## 5. Errungenschaften

In Steamworks unter „Statistiken & Errungenschaften“ anlegen. Der **API-Name** muss genau so heißen, das Spiel meldet ihn so. Danach „Veröffentlichen“ nicht vergessen.

| API-Name | Deutsch | English | Bedingung im Spiel |
|---|---|---|---|
| ACH_ERSTE_EPOCHE | Neue Zeit | A New Age | zum ersten Mal in eine neue Epoche aufsteigen |
| ACH_ROHSTOFFE1000 | Volle Kornkammer | Full Granary | 1000 Rohstoffe sammeln |
| ACH_ZEHN_GEBAEUDE | Dorfgründer | Village Founder | 10 Gebäude errichten |
| ACH_STEIN | Steinzeit-Überlebender | Stone Age Survivor | 10 Minuten überstehen |
| ACH_SIEG | Eroberer | Conqueror | eine Partie gewinnen |
| ACH_EPOCHE5 | Aufsteiger | Climber | die 5. Epoche erreichen |
| ACH_BAUMEISTER | Baumeister | Master Builder | 20 Gebäude errichten |
| ACH_FESTUNG | Festungsherr | Lord of the Keep | 5 Türme gleichzeitig besitzen |
| ACH_REICH | Schatzkammer | Treasury | 2000 Gold auf einmal besitzen |
| ACH_HAENDLER | Händler | Merchant | 100 Gold per Karawane transportieren |
| ACH_SAMMLER | Sammler | Gatherer | 10 000 Rohstoffe sammeln |
| ACH_HEER | Heerführer | Warlord | 100 Einheiten ausbilden |
| ACH_FELDHERR | Großer Feldherr | Great General | 50 feindliche Einheiten besiegen |
| ACH_FORSCHER | Forscher | Scholar | 8 Stufen einer Technologielinie erforschen |
| ACH_WUNDER | Weltwunder | Wonder of the World | ein Weltwunder vollenden |
| ACH_ZEIT | Zeitreisender | Time Traveller | die 10. Epoche erreichen |

English descriptions: *Advance to a new epoch for the first time · Gather 1,000 resources · Construct 10 buildings · Survive for 10 minutes · Win a match · Reach the 5th epoch · Construct 20 buildings · Own 5 towers at once · Hold 2,000 gold at once · Deliver 100 gold by caravan · Gather 10,000 resources · Train 100 units · Defeat 50 enemy units · Research 8 levels of one technology line · Complete a Wonder · Reach the 10th epoch.*

## 6. Hochladen mit SteamPipe

Dateien in `steam/steampipe/`:
- `app_build.vdf`: App-ID, Quelle (`release/steam/win-unpacked/`), Depot-Zuordnung
- `depot_build.vdf`: welche Dateien ins Depot kommen (alles außer `.pdb` und `steam_appid.txt`)
- `upload.bat`: baut die Steam-Fassung und lädt sie mit steamcmd hoch

Einmalig:
1. SteamCMD von <https://developer.valvesoftware.com/wiki/SteamCMD> nach `C:\steamcmd` entpacken und einmal `steamcmd.exe` starten (lädt sich selbst nach).
2. Im Steamworks-Konto einen eigenen Build-Nutzer mit Recht „Edit App Metadata“ + „Publish App Changes To Steam“ anlegen (empfohlen, damit nicht das Hauptkonto dauernd Steam Guard bestätigen muss).

Jedes Update:
```bat
cd steam\steampipe
upload.bat BUILD_LOGIN
```
Beim ersten Mal fragt steamcmd nach Passwort und Steam-Guard-Code. Danach den Build in Steamworks unter „SteamPipe → Builds“ auf `default` setzen.

Updates auf Steam laufen nur über Steam: die Steam-Fassung hat keinen GitHub-Update-Watcher.

## 7. Store-Texte

### Deutsch

**Kurzbeschreibung** (max. 300 Zeichen):
> Führe dein Volk von der Steinzeit bis in die Moderne. Empire XY verbindet klassische Echtzeitstrategie mit Aufbau und Produktionsketten: zehn Epochen, fünf Völker, Diplomatie, Seefahrt, Weltwunder und ein Baustein-System, mit dem du das Spiel selbst erweiterst.

**Lange Beschreibung:**

> **Vom ersten Lagerfeuer bis zum Panzer**
> Empire XY ist Echtzeitstrategie in der Tradition der großen Klassiker. Du beginnst mit einer Handvoll Arbeiter in der Steinzeit und baust ein Reich, das zehn Epochen überdauert: Kupfer-, Bronze- und Eisenzeit, Mittelalter, Renaissance, Kolonialzeit, Industriezeitalter, Weltkriegszeit und Moderne. Mit jeder Epoche ändern sich Gebäude, Kleidung, Waffen und Taktik.
>
> **Aufbauen, versorgen, verteidigen**
> - Rohstoffe sammeln, Häuser, Mühlen, Märkte und Burgen errichten
> - Produktionsketten: Weizen zu Mehl zu Brot, Holz zu Brettern, Erz zu Werkzeug
> - Beliebtheit deines Volkes über Tempel und Märkte steuern
> - Mauern ziehen, Tore setzen, Türme und Festungen bauen
>
> **Kämpfen mit Köpfchen**
> - Über 30 Einheitentypen von Speerträgern über Ritter bis zu Artillerie und Panzern
> - Schiffe, Häfen und Seeschlachten
> - Diplomatie mit Tribut, Waffenstillstand und Kriegserklärung
> - Eine KI, die flankiert, sich zurückzieht und in Wellen angreift
>
> **Fünf Völker** – Römer, Mongolen, Azteken, Germanen und Ägypter, jedes mit eigenem Vorteil.
>
> **Eine lebendige Welt** – Wetter, Tag und Nacht, Naturkatastrophen, Karawanen, Religion und eine Chronik, die die Geschichte deiner Stadt erzählt.
>
> **Baustein-System** – Empire XY ist aus Bausteinen zusammengesetzt. Schreibe eigene Einheiten, Gebäude, Epochen und Regeln als kleine JavaScript-Datei und lege sie in den Bausteine-Ordner: das Spiel lädt sie sofort.
>
> **Außerdem:** Karteneditor, Zeitlimit-Partien mit Punktewertung, drei Speicherplätze, automatisches Speichern, Steam Cloud und 16 Errungenschaften.

### English

**Short description** (max. 300 characters):
> Lead your people from the Stone Age to the Modern Era. Empire XY blends classic real-time strategy with city building and production chains: ten epochs, five civilizations, diplomacy, naval warfare, Wonders and a modding system that lets you extend the game yourself.

**About this game:**

> **From the first campfire to the tank**
> Empire XY is real-time strategy in the tradition of the great classics. Start with a handful of workers in the Stone Age and build an empire that endures across ten epochs: the Copper, Bronze and Iron Ages, the Middle Ages, Renaissance, Colonial Era, Industrial Age, World War Era and the Modern Age. Every epoch changes your buildings, clothing, weapons and tactics.
>
> **Build, supply, defend**
> - Gather resources and raise houses, mills, markets and castles
> - Production chains: wheat to flour to bread, logs to planks, ore to tools
> - Keep your people happy with temples and markets
> - Draw walls, place gates, build towers and fortresses
>
> **Fight smart**
> - More than 30 unit types, from spearmen and knights to artillery and tanks
> - Ships, harbours and naval battles
> - Diplomacy with tribute, ceasefires and declarations of war
> - An AI that flanks, retreats and attacks in waves
>
> **Five civilizations** – Romans, Mongols, Aztecs, Germanic tribes and Egyptians, each with its own advantage.
>
> **A living world** – weather, day and night, natural disasters, caravans, religion and a chronicle that tells the story of your city.
>
> **Building-block modding** – Empire XY is made of building blocks. Write your own units, buildings, epochs and rules as a small JavaScript file, drop it into the mods folder and the game loads it instantly.
>
> **Also included:** map editor, timed matches with scoring, three save slots, autosave, Steam Cloud and 16 achievements.

**Hinweis Sprache:** Das Spiel ist derzeit nur auf Deutsch. In Steamworks unter „Sprachen“ nur **Deutsch** (Oberfläche, Untertitel) ankreuzen. Die englische Store-Seite ist trotzdem sinnvoll, sie muss dann aber klar sagen: *“Language: German only.”* Eine englische Übersetzung des Spiels würde die Reichweite deutlich vergrößern.

**Tags (Vorschlag):** Echtzeitstrategie, Strategie, Aufbau, Basisbau, Historisch, Mittelalter, Einzelspieler, Indie, 2D, Draufsicht, Moddbar, Ressourcenmanagement, Krieg, Militär, Wirtschaft
