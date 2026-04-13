#!/bin/bash
# Einmalig auf dem Server ausführen um das Let's Encrypt Zertifikat zu holen.
# Danach reicht ./deploy.sh für alle weiteren Deploys.
#
# Voraussetzung: DNS zeigt bereits auf diesen Server.
# Ausführen: ssh root@91.99.228.92 "cd /opt/material-library && bash init-letsencrypt.sh"

set -e

DOMAIN="materialien.reallabor-zekiwa-zeitz.de"
EMAIL="martin.wiesner@hs-anhalt.de"
CERT_PATH="./certbot/conf/live/$DOMAIN"

echo "📁 Verzeichnisse anlegen..."
mkdir -p "$CERT_PATH"
mkdir -p ./certbot/www

echo "🔐 Temporäres selbstsigniertes Zertifikat erstellen (damit nginx starten kann)..."
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CERT_PATH/privkey.pem" \
  -out "$CERT_PATH/fullchain.pem" \
  -subj "/CN=localhost" 2>/dev/null
echo "   ✓ Temporäres Zertifikat erstellt"

echo "🚀 Services starten..."
docker compose up -d --build
echo "   ⏳ Warte 8 Sekunden bis nginx bereit ist..."
sleep 8

echo "🌐 Let's Encrypt Zertifikat anfordern..."
docker compose run --rm --no-deps certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "$DOMAIN"

echo "🔄 Nginx neu laden..."
docker compose exec frontend nginx -s reload

echo ""
echo "✅ Fertig! Die App ist jetzt erreichbar unter:"
echo "   https://$DOMAIN"
echo ""
echo "Das Zertifikat wird automatisch alle 12h auf Erneuerung geprüft."
