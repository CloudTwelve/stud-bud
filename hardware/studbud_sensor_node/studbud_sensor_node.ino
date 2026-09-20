/*
 * Stud-Bud sensor node — Arduino UNO R4 WiFi
 *
 * Reads temperature, humidity, sound and light from one room and POSTs a
 * sweep to /api/readings every SWEEP_INTERVAL_MS.
 *
 * Wiring (UNO R4 WiFi, 3V3 logic on the I2C pins):
 *   DHT22 data  -> D2   (10k pull-up between data and 5V)
 *   BH1750 SDA  -> SDA, SCL -> SCL, VCC -> 3V3, ADDR -> GND
 *   Sound module analog out -> A0   (envelope/AO pin, not the digital gate)
 *
 * Libraries (Library Manager):
 *   "DHT sensor library" by Adafruit (+ "Adafruit Unified Sensor")
 *   "BH1750" by Christopher Laws
 *   "ArduinoJson" by Benoit Blanchon
 *
 * Copy arduino_secrets_example.h to arduino_secrets.h and fill it in; that
 * file is gitignored so your WiFi password and ingest token stay local.
 */

#include <Arduino.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>
#include <BH1750.h>
#include <DHT.h>
#include <WiFiS3.h>
#include <Wire.h>

#include "arduino_secrets.h"

// ---- what this node is reporting -------------------------------------------
static const char SPACE_ID[] = "hayden-reading-room";
static const char SPACE_NAME[] = "Hayden Reading Room";
static const char SPACE_BUILDING[] = "Building 14";
// Occupancy: set HAS_SEAT_SENSOR to 1 and fill in readOccupiedSeats() if this
// node counts seats. With it at 0 the sweep omits both seat fields and the
// server keeps the last count the robot dog reported, instead of overwriting
// it with a made-up zero every minute.
#define HAS_SEAT_SENSOR 0

#if HAS_SEAT_SENSOR
static const int TOTAL_SEATS = 60;

static int readOccupiedSeats() {
  return 0;  // TODO: read your doorway counter / per-table sensors here
}
#endif

// ---- pins and timing --------------------------------------------------------
static const uint8_t DHT_PIN = 2;
static const uint8_t SOUND_PIN = A0;
static const unsigned long SWEEP_INTERVAL_MS = 60000UL;  // one sweep a minute
static const unsigned long SOUND_WINDOW_MS = 1000UL;     // sample noise for 1 s

// Calibrate these two with a phone SPL meter (see hardware/README.md).
static const float SOUND_DB_AT_QUIET = 32.0f;  // dB reading in a silent room
static const float SOUND_DB_PER_COUNT = 0.12f; // dB added per ADC count above quiet
static const int SOUND_QUIET_COUNTS = 12;      // ADC swing measured in that silent room

DHT dht(DHT_PIN, DHT22);
BH1750 lightMeter;
WiFiSSLClient sslClient;
WiFiClient plainClient;

static unsigned long lastSweep = 0;

// Peak-to-peak swing of the microphone envelope, converted to a rough dB SPL.
static float readSoundDb() {
  unsigned long start = millis();
  int high = 0;
  int low = 1023;

  while (millis() - start < SOUND_WINDOW_MS) {
    int sample = analogRead(SOUND_PIN);
    if (sample > high) high = sample;
    if (sample < low) low = sample;
  }

  int swing = high - low;
  float db = SOUND_DB_AT_QUIET + (swing - SOUND_QUIET_COUNTS) * SOUND_DB_PER_COUNT;
  return constrain(db, 25.0f, 110.0f);
}

static void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("wifi: connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000UL) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("wifi: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("wifi: failed, retrying next sweep");
  }
}

static void postSweep(float temperature, float humidity, float sound, float light) {
  Client &transport = STUDBUD_USE_TLS ? (Client &)sslClient : (Client &)plainClient;
  HttpClient http(transport, STUDBUD_HOST, STUDBUD_PORT);

  JsonDocument doc;
  doc["spaceId"] = SPACE_ID;
  doc["name"] = SPACE_NAME;
  doc["building"] = SPACE_BUILDING;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"] = round(humidity * 10) / 10.0;
  doc["sound"] = round(sound * 10) / 10.0;
  doc["light"] = (int)light;
#if HAS_SEAT_SENSOR
  doc["occupiedSeats"] = readOccupiedSeats();
  doc["totalSeats"] = TOTAL_SEATS;
#endif

  String body;
  serializeJson(doc, body);

  http.beginRequest();
  http.post("/api/readings");
  http.sendHeader("Content-Type", "application/json");
  if (strlen(STUDBUD_INGEST_TOKEN) > 0) {
    http.sendHeader("Authorization", String("Bearer ") + STUDBUD_INGEST_TOKEN);
  }
  http.sendHeader("Content-Length", body.length());
  http.beginBody();
  http.print(body);
  http.endRequest();

  int status = http.responseStatusCode();
  Serial.print("post: ");
  Serial.print(status);
  Serial.print(' ');
  Serial.println(body);
  if (status != 201) Serial.println(http.responseBody());
  http.stop();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  analogReadResolution(10);
  dht.begin();
  Wire.begin();
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("bh1750: not found, light will read 0");
  }

  connectWiFi();
  lastSweep = millis() - SWEEP_INTERVAL_MS;  // sweep immediately on boot
}

void loop() {
  if (millis() - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = millis();

  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("dht: bad read, skipping sweep");
    return;
  }

  float light = lightMeter.readLightLevel();
  if (light < 0) light = 0;

  postSweep(temperature, humidity, readSoundDb(), light);
}
