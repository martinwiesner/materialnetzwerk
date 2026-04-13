# RZZ Materialien

Plattform zur Verwaltung und Vernetzung von Materialien, Projekten und Akteuren der Kreislaufwirtschaft – entwickelt für das Reallabor Zekiwa Zeitz.

## Stack

- **Frontend** – React + Vite + Tailwind CSS
- **Backend** – Node.js + Express
- **Datenbank** – SQLite (better-sqlite3)
- **Deployment** – Docker Compose auf Hetzner (Ubuntu 24.04)

## Lokale Entwicklung

```bash
# Backend
cd backend
cp CHANGE.env .env   # .env anpassen
npm install
npm run dev          # läuft auf :8081

# Frontend
cd frontend
npm install
npm run dev          # läuft auf :5173
```

## Deployment

```bash
./deploy.sh "beschreibung der änderung"
```

Das Script:
1. Committet und pusht nach GitHub
2. Überträgt Dateien per rsync auf den Server
3. Baut Docker-Container neu und startet sie

## Umgebungsvariablen

Siehe `backend/CHANGE.env` als Vorlage. Die `.env` wird **nicht** ins Git eingecheckt.

Wichtige Variablen:

| Variable | Beschreibung |
|---|---|
| `JWT_SECRET` | Zufälliger Secret-String |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push Schlüssel |
| `BREVO_API_KEY` | Brevo API Key für E-Mail-Benachrichtigungen |
| `BREVO_FROM_EMAIL` | Absender-Adresse (muss in Brevo verifiziert sein) |
| `APP_URL` | Öffentliche URL der App |

## Produktion

- **URL:** http://materialien.reallabor-zekiwa-zeitz.de
- **Server:** Hetzner CX22, Ubuntu 24.04
- **Daten:** `/opt/material-library/data/` (DB + Uploads — nicht im Git)

## Features

- Materialien anlegen mit Bildern, technischen Daten, Nachhaltigkeitsinfos
- Materialangebote (Inventory) mit Standort und Verfügbarkeit
- Projekte mit Schritt-für-Schritt-Anleitungen und GWP-Berechnung
- Akteure (Makerspaces, Repair Cafés, Betriebe etc.)
- Explore-Ansicht mit Karte
- Benutzeraccounts mit Rollen (Admin / User)
- Internes Nachrichtensystem
- E-Mail-Benachrichtigungen via Brevo
- Web Push Notifications
