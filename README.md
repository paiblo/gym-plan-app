# Gym Plan

Mobile-first PWA für iPhone mit Benutzerkonto, Cloud-Synchronisierung und Trainings-Tracking.

## Funktionen
- Wochenplan mit Trainingstagen und Rest Days
- Gewicht und Wiederholungen pro Übung
- Mehrere Sätze, Notizen, PRs und Trainingsverlauf
- Bearbeitbarer Trainingsplan mit ein-/ausklappbaren Kategorien
- Benutzerkonto mit Profil, Rang und Statistiken
- Freunde hinzufügen und miteinander vergleichen
- Körpergewicht mit Verlauf tracken; angenommene Freunde können es im Vergleich sehen
- Cloud-Speicherung über Supabase mit lokalen Sicherheitskopien
- Versionierte Trainingsstände und append-only Trainings-/Gewichtsereignisse
- Offline-Unterstützung über Service Worker
- iPhone Standalone/PWA-Metadaten

## Installation auf iPhone
Die App wird über GitHub Pages per HTTPS bereitgestellt. In Safari öffnen, Teilen wählen und **Zum Home-Bildschirm** auswählen.

## Datenschutz und Datenhaltung
GitHub enthält nur den öffentlichen App-Code. Persönliche Trainings-, Profil- und Gewichtsdaten werden dem angemeldeten Benutzer in Supabase zugeordnet. Trainingszustände werden zusätzlich versioniert und lokal abgesichert. Gewichts- und Trainingsereignisse sind append-only und werden nicht über die App gelöscht oder überschrieben. Körpergewicht ist nur für den jeweiligen Benutzer und bestätigte Freunde lesbar.