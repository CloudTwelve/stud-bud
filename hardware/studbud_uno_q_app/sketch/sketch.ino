/*
 * Stud-Bud sensor node - MCU side (Arduino UNO Q, STM32U585).
 *
 * The MCU owns the sensors, the Linux side owns the network: every couple of
 * seconds this pushes one sample over the Bridge and python/main.py decides
 * when to POST a sweep to the dashboard.
 *
 * The headers are 3.3 V and the analog pins are NOT 5 V tolerant, so power
 * every sensor from 3V3, never from 5V.
 */

#include <Arduino.h>
#include <Arduino_RouterBridge.h>

#include <Arduino_Modulino.h>
#include <DHT.h>

#define DHT_PIN 2
#define DHT_TYPE DHT22
#define MIC_PIN A0

// Sound calibration: swing is the peak-to-peak ADC count over one second.
// Replace these with your own two points, see hardware/README.md.
static const float SOUND_QUIET_COUNTS = 30.0f;
static const float SOUND_DB_AT_QUIET = 33.0f;
static const float SOUND_DB_PER_COUNT = 0.32f;

static DHT dht(DHT_PIN, DHT_TYPE);
static ModulinoLight light;
static bool lightReady = false;

static float lastTemperature = NAN;
static float lastHumidity = NAN;
static float lastLight = NAN;

static float readSoundDb() {
  const unsigned long window = 1000;
  unsigned long start = millis();
  int low = 4095;
  int high = 0;

  while (millis() - start < window) {
    int sample = analogRead(MIC_PIN);
    if (sample < low) low = sample;
    if (sample > high) high = sample;
  }

  float swing = (float)(high - low);
  return SOUND_DB_AT_QUIET + (swing - SOUND_QUIET_COUNTS) * SOUND_DB_PER_COUNT;
}

void setup() {
  Monitor.begin();
  Bridge.begin();

  dht.begin();

  // Modulino nodes hang off the Qwiic connector, which on the UNO Q is the
  // second I2C bus - the library picks Wire1 for this board on its own.
  Modulino.begin();
  lightReady = light.begin();
  if (!lightReady) {
    Monitor.println("Modulino Light not found - check the Qwiic cable");
  }
}

void loop() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  if (!isnan(temperature)) lastTemperature = temperature;
  if (!isnan(humidity)) lastHumidity = humidity;

  if (lightReady && light.update()) {
    lastLight = (float)light.getLux();
  }

  float sound = readSoundDb();

  // A sensor that has never answered stays NAN; Python drops those samples
  // rather than posting a made-up number.
  Bridge.notify("sample", lastTemperature, lastHumidity, sound, lastLight);

  Monitor.print("t=");
  Monitor.print(lastTemperature);
  Monitor.print(" h=");
  Monitor.print(lastHumidity);
  Monitor.print(" dB=");
  Monitor.print(sound);
  Monitor.print(" lux=");
  Monitor.println(lastLight);

  delay(2000);
}
