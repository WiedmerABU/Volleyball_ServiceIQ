# ServeIQ 0.1 – Funktionstest für GitHub Pages

**Volleyball · Service · Score Tracker** – funktionaler Prototyp für Trainerinnen und Trainer, **ohne Datenbank, ohne Anmeldung und ohne bezahlten Server**.

> Status: **Testversion 0.1, kein freigegebenes Wettkampfprodukt.** Die Oberfläche ist noch nicht das finale Design. Die wichtigsten Spielregeln sind in automatisierten Modelltests geprüft; die vollständige Bedienung muss nach Veröffentlichung auf Smartphone und Laptop praktisch getestet werden.

## 1. Was funktioniert?

- **Teams:** Verein, Saison, Kategorie, Liga/Gruppe, Spielerinnen mit Trikotnummern (1–99) und Position; Kader sortieren, bearbeiten, löschen.
- **Neues Spiel:** Team auswählen, Gegner, Datum, Matchkader, sechs Startspielerinnen in Rotationspositionen 1–6, optionale Libera, Spielfeldseite, erste servierende Mannschaft.
- **Live-Game:** Punkte und Sätze, Ass / normaler Service / Servicefehler; nach einem normalen Service den Ballwechselgewinner erfassen; Gegner-Serviceansicht; korrekte Side-out-Rotation; Rückgängig und Vorwärts.
- **Spielerwechsel:** reguläre Wechsel und paarweise Rückwechsel, maximal sechs pro Satz; eigene manuelle Liberawechsel und Prüfhinweis.
- **Sätze:** Sätze 1–4 bis 25, Satz 5 bis 15, immer zwei Punkte Vorsprung; automatische Satzerkennung, Seitenwechsel im fünften Satz bei 8, Best of five. Startaufstellung aus dem vorherigen Satz als Vorschlag.
- **Statistik:** Ass/Normal/Fehler, Service-Effizienz und Punktquote, Fehlerquote, zwei Servicefehler-Muster, vier Spielstandsphasen, Spielbeteiligung pro Spielerin und Satz inkl. Einsatzabschnitten, Wechselverlauf und Info-Erklärungen.
- **Archiv:** abgeschlossene, laufende und abgebrochene Spiele; Excel-Export mit sieben Tabellenblättern; vollständige JSON-Sicherung und -Wiederherstellung.
- **Technik:** lokale Speicherung per IndexedDB mit lokalem Fallback; PWA/Offline-Cache nach erstem vollständigen Laden.

## 2. GitHub Pages installieren (Schritt für Schritt)

1. ZIP-Datei auf dem Laptop **entpacken**.
2. Auf **github.com** anmelden und ein neues Repository anlegen, zum Beispiel `serveiq`.
3. **Add file → Upload files** wählen.
4. Den **Inhalt des entpackten Ordners** hochladen: `index.html`, `styles.css`, `sw.js`, `manifest.webmanifest`, `js/`, `assets/`, `tests/` und diese `README.md`. **Nicht einfach die ZIP als Einzeldatei hochladen!**
5. Unten **Commit changes** bestätigen.
6. Im Repository **Settings → Pages** öffnen.
7. Unter **Build and deployment → Source** `Deploy from a branch` wählen, Branch `main`, Ordner `/ (root)` und **Save**.
8. Die angezeigte GitHub-Pages-Adresse öffnen, etwa `https://DEIN-BENUTZERNAME.github.io/serveiq/`. Die Veröffentlichung kann ein paar Minuten benötigen.

Die App benötigt **keinen npm-Build und keine zusätzlichen Pakete**. Ihr GitHub-Repository muss GitHub Pages für den gewählten Plan und die Sichtbarkeit unterstützen.

## 3. Erster Test

1. **START** tippen und unter **Teams** ein Team anlegen.
2. Mindestens sechs reguläre Spielerinnen und optional eine Libera erfassen. Jede Trikotnummer darf nur einmal vorkommen.
3. **Neues Spiel** wählen, Matchkader bestätigen, sechs Startspielerinnen verteilen, ersten Service wählen.
4. **Ass** erfassen → Interlaken erhält einen Punkt, dieselbe Spielerin bleibt am Service.
5. **Normaler Service** → der Punktestand bleibt; erst **Punkt Interlaken** oder **Punkt Gegner** zählt.
6. **Servicefehler** → Gegner erhält einen Punkt und übernimmt den Service.
7. Bei Gegner-Service **Punkt Interlaken** → Punkt und einmalige Rotation; nächste Spielerin serviert.
8. **Rückgängig** und **Vorwärts** ausprobieren, auch nach Servicewechsel oder Spielerwechsel.
9. **Statistik** und Info-Buttons öffnen; Excel herunterladen und in Excel prüfen.
10. Unter **Archiv** eine **JSON-Sicherung** herunterladen und sicher aufbewahren.

Weitere Tests stehen in **TESTPROTOKOLL.md**.

## 4. Wichtige Grenzen

- **Kein automatischer Abgleich zwischen verschiedenen Geräten.** Smartphone und Laptop haben je einen eigenen lokalen Datenspeicher. Auch unterschiedliche Browser auf demselben Gerät teilen diese Daten nicht automatisch. Dafür gibt es **JSON exportieren/importieren**.
- **Keine gemeinsame Mannschaftsdatenbank.** Mehrere Trainer können dieselbe App verwenden, sehen aber nicht automatisch die Teams oder Spiele anderer Trainer.
- **Browserdaten löschen, Inkognito-Modus oder Geräteverlust** kann lokale Daten zerstören. Regelmässige JSON-Backups sind zwingend empfohlen.
- **Excel ist nur für Auswertungen**, nicht zum erneuten Importieren des Spielverlaufs. Der Excel-Export benötigt keine externe Bibliothek.
- **Libera-Sonderfälle** (z. B. Verletzung, Neubenennung, zweiter Libera sowie regelbedingte Ausnahmen) und **Ausnahmewechsel bei Verletzungen** sind in 0.1 nicht vollständig abgebildet. Für offizielle Matches nicht ohne Kontrolle verwenden.
- **Keine manuelle Spielstandkorrektur unabhängig von Ballwechseln:** Eine fehlende Rallye lässt sich bislang nur über den normalen Erfassungsablauf nachtragen beziehungsweise per Rückgängig korrigieren.
- **Keine Cloud-Sicherung und keine Benutzerverwaltung** – bewusst so entschieden.
- **Design in Phase 2:** Der Splash Screen verwendet derzeit eine neutrale, markenfreie Darstellung und nicht die endgültige Foto-/Logo-Komposition. Zuvor verworfene UI-Mockups wurden nicht übernommen.
- **Browsertest:** Automatisierte Regel- und Dateitests wurden durchgeführt. Ein vollständiger grafischer Browser-End-to-End-Test war in der Erstellungslaufzeit technisch gesperrt; bitte das Testprotokoll vor produktivem Einsatz durchgehen.

## 5. Aufbau für die Weiterentwicklung

```
index.html              App-Einstieg
styles.css              Vorläufige Oberfläche
js/app.js               Screens und Bedienung
js/model.js             Volleyballregeln und Statistik
js/storage.js           Lokaler Datenspeicher
js/excel.js             Offline-Excel-Export ohne Abhängigkeiten
sw.js                   Offline-Cache
manifest.webmanifest    Installierbare Web-App
assets/icon.svg         Platzhalter-App-Icon
tests/                  Reproduzierbare Modell- und Dateitests
```

## 6. Tests für Entwickler

Auf einem PC mit Node.js Version 20 oder neuer können die automatisierten Tests ausgeführt werden:

```
node tests/model.test.mjs
node tests/extended.test.mjs
node tests/excel.test.mjs
```

Bei der Excel-Testdatei `tests/test-export.xlsx` handelt es sich nur um eine automatisch erzeugte temporäre Prüfausgabe. Sie muss **nicht** auf GitHub hochgeladen werden.

## 7. Datensicherheit und Berechnungsregeln

- Pro abgeschlossenem Ballwechsel wird **genau ein Punkt** vergeben.
- Ein normaler Service wird als gültiger Aufschlag gezählt, sobald der Ballwechsel entschieden wurde.
- **Service-Effizienz** = (Asse − Servicefehler) / Services × 100.
- **Punktquote** = gewonnene Ballwechsel bei eigenem Aufschlag / eigene Services × 100.
- **Einsatzquote** = Ballwechsel der Spielerin auf dem Feld / alle Ballwechsel des Satzes × 100.
- Spielstandsphasen werden nach dem **Punktestand vor dem Service** zugeordnet.
- Die im Statistik-Infofenster genannten Leistungsgrenzen sind **inoffizielle Orientierungswerte** für Amateurteams, keine offiziellen Grenzwerte.
- Jede Partie speichert eine unveränderliche **Team-/Kaderkopie**. Spätere Teamänderungen verändern vergangene Matches nicht.

---

**Geplant nach Testphase:** Korrekturen aus dem praktischen Test, weitergehende Libera-/Ausnahmeregeln, abschliessende UI/UX-Gestaltung in Phase 2.
