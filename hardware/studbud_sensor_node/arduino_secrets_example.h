// Copy to arduino_secrets.h and fill in. arduino_secrets.h is gitignored.
#pragma once

#define WIFI_SSID "your-network"
#define WIFI_PASSWORD "your-password"

// Where the dashboard runs. For a laptop on the same WiFi use its LAN IP and
// port 3000; for a deployed site use the hostname, port 443 and TLS.
#define STUDBUD_HOST "192.168.1.42"
#define STUDBUD_PORT 3000
#define STUDBUD_USE_TLS 0

// Must match STUDBUD_INGEST_TOKEN on the server; "" when ingest is open.
#define STUDBUD_INGEST_TOKEN ""
