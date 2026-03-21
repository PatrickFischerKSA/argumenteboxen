# Argumenteboxen

![Argumenteboxen Vorschau](./assets/preview.svg)

Ein eigenstaendiges Zwei-Spieler-Argumentespiel fuer zwei Computer zur Streitfrage:

**Soll Sport ein Promotionsfach werden?**

Zwei Kaengurus treten als `Pro` und `Contra` im Ring gegeneinander an. Ein Angriff besteht aus einem Argument, die Abwehr aus einem Gegenargument. Ist die Abwehr valide, wechselt die Initiative. Ist sie nicht valide, zaehlt der Schlag als Volltreffer. Wer drei Volltreffer kassiert, geht KO.

## Highlights

- Lokales Multiplayer-Duell fuer zwei Browser auf zwei verschiedenen Computern
- Klare `Pro`- und `Contra`-Argumentkarten aus der Materialsammlung zum Promotionsfach Sport
- Schnelle Arena-Animationen mit Angriff, Parade, Treffer und KO
- Schaltbare Browser-Sounds fuer Glocke, Schlaege und Volltreffer
- Revanche im selben Raum ohne neues Setup
- Komplett getrenntes Projekt, nicht mit anderen Workspace-Apps vermischt

## Spielidee

`Pro` eroeffnet den ersten Schlagabtausch. Die andere Seite reagiert mit einem Gegenargument:

- Valide Abwehr: kein Treffer, Initiative-Wechsel
- Ungueltige Abwehr: Volltreffer
- Drei Volltreffer: KO

Damit wird die Debatte nicht nur gesammelt, sondern als kompetitives Argumenteduell inszeniert.

## Vorschau

- Roter und blauer Kaenguru-Charakter im Boxring
- Live-Kampfprotokoll mit Argumenten und Gegenargumenten
- Trefferanzeige fuer beide Seiten
- Raumcode-System fuer die Partie auf zwei Geraeten

## Schnellstart

```bash
npm install
npm start
```

Danach im Browser oeffnen:

- lokal: `http://localhost:3000`
- zweiter Computer im selben Netzwerk: `http://DEINE-LOKALE-IP:3000`

## So wird gespielt

1. Computer 1 erstellt einen Raum.
2. Computer 2 tritt mit dem angezeigten Raumcode bei.
3. Die Host-Seite startet das Match.
4. `Pro` greift mit einer Argumentkarte an.
5. `Contra` verteidigt mit einer Gegenargumentkarte.
6. Bei valider Abwehr wechselt die Initiative.
7. Bei ungueltiger Abwehr gibt es einen Treffer.
8. Nach drei Treffern ist das Match per KO beendet.
9. Die Host-Seite kann direkt eine Revanche starten.

## Inhaltliche Grundlage

Die Argumentkarten wurden aus der Materialsammlung zum Thema
`Sport als Promotionsfach` aufgebaut. Im Zentrum steht die Konfliktfrage:

**Was soll Schule bewerten: ganzheitliche Bildung oder primaer kognitive Leistung?**

## Technik

- `Node.js`
- `Express`
- `ws` fuer Echtzeit-Kommunikation per WebSocket
- Vanilla HTML, CSS und JavaScript
- Integrierte SVG-Figuren statt externer Grafik-Abhaengigkeiten

## Projektstruktur

- `server.js`
  Raumlogik, Match-Zustaende, Treffer, KO und Revanche
- `src/cards.js`
  Argumentkarten und gueltige Gegenargumente
- `public/index.html`
  Spieloberflaeche mit Arena, Setup und Kartenbereich
- `public/styles.css`
  visuelles Design, Ring, Kaengurus und Bewegungsanimationen
- `public/app.js`
  Client-Rendering, WebSocket-Anbindung, Audio und Bewegungs-Cues
- `assets/preview.svg`
  GitHub-Vorschaubild fuer das Repository

## Einsatzidee

Das Projekt eignet sich besonders fuer:

- Unterrichtseinstiege in Debatten zum Bildungsauftrag
- Wiederholung von `Pro`- und `Contra`-Argumenten
- spielerische Vorbereitung auf muendliche Diskussionen
- motivierende Partnerarbeit mit klarer Rollenverteilung

## Entwicklung

Wenn du das Repo `argumenteboxen` auf GitHub anlegst, kannst du diesen Ordner direkt als eigenstaendiges Projekt uebernehmen.

