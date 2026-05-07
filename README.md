# RZZ Materialien

Plattform zur Verwaltung und Vernetzung von Materialien, Projekten und Akteuren der Kreislaufwirtschaft – entwickelt für das Reallabor Zekiwa Zeitz.

## Stack

- **Frontend** – React + Vite + Tailwind CSS
- **Backend** – Node.js + Express
- **Datenbank** – SQLite (better-sqlite3)
- **Authentifizierung** – [Zitadel](https://zitadel.com) OIDC (OpenID Connect)
- **Deployment** – Docker Compose auf Hetzner (Ubuntu 24.04)

## Authentifizierung (Zitadel OIDC)

Die Plattform verwendet **Zitadel** als Identity Provider. Eigene Passwort-Hashes oder JWT-Signierung entfallen – alle Tokens werden von Zitadel ausgestellt und vom Backend über JWKS verifiziert.

### Zitadel einrichten

1. Zitadel-Instanz erstellen (Cloud: [zitadel.com](https://zitadel.com) oder Self-Hosted)
2. Neues **Projekt** anlegen
3. Im Projekt eine **User Agent**-Applikation anlegen (PKCE, kein Client Secret)
4. Redirect URIs eintragen:
   - `http://localhost:5173/callback` (Dev)
   - `https://yourdomain.com/callback` (Produktion)
5. **Domain** und **Client ID** in die Umgebungsvariablen eintragen (siehe unten)

### Ersten Admin einrichten

Nach dem ersten Login über Zitadel kann ein Nutzer zum Admin befördert werden:

```bash
cd backend
node scripts/create-admin.js <zitadel-sub-or-email>
```

## Lokale Entwicklung

```bash
# Backend
cd backend
cp CHANGE.env .env   # Werte aus .env.secret übernehmen
npm install
npm run dev          # läuft auf :8081

# Frontend
cd frontend
cp .env.example .env.local   # Zitadel-Werte eintragen
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

Öffentliche Vorlage: `backend/CHANGE.env` und `frontend/.env.example`.  
Private Werte (nicht im Git): `backend/.env.secret` und `frontend/.env.secret`.

### Backend

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `ZITADEL_DOMAIN` | Domain der Zitadel-Instanz (ohne `https://`) | ✅ |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push Schlüssel (`npx web-push generate-vapid-keys`) | optional |
| `VAPID_SUBJECT` | Kontakt-E-Mail für VAPID | optional |
| `BREVO_API_KEY` | Brevo API Key für E-Mail-Benachrichtigungen | optional |
| `BREVO_FROM_EMAIL` | Absender-Adresse (muss in Brevo verifiziert sein) | optional |
| `FRONTEND_URL` | Öffentliche Frontend-URL (CORS) | optional |
| `APP_URL` | Öffentliche URL der App (für Links in E-Mails) | optional |

### Frontend

| Variable | Beschreibung | Pflicht |
|---|---|---|
| `VITE_ZITADEL_AUTHORITY` | Vollständige URL der Zitadel-Instanz | ✅ |
| `VITE_ZITADEL_CLIENT_ID` | Client ID der „User Agent"-App in Zitadel | ✅ |
| `VITE_API_URL` | Backend-URL (leer lassen wenn nginx proxied) | optional |

## Produktion

- **URL:** https://materialien.reallabor-zekiwa-zeitz.de
- **Server:** Hetzner CX22, Ubuntu 24.04
- **Daten:** `/opt/material-library/data/` (DB + Uploads — nicht im Git)

## Features

- Materialien anlegen mit Bildern, technischen Daten, Nachhaltigkeitsinfos
- Materialangebote (Inventory) mit Standort und Verfügbarkeit
- Projekte mit Schritt-für-Schritt-Anleitungen und GWP-Berechnung
- Akteure (Makerspaces, Repair Cafés, Betriebe etc.)
- Explore-Ansicht mit Karte
- Benutzeraccounts mit Rollen (Admin / User) via Zitadel OIDC
- Internes Nachrichtensystem
- E-Mail-Benachrichtigungen via Brevo
- Web Push Notifications
