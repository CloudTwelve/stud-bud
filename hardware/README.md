# Building the Stud-Bud sensor node

Everything the dashboard shows comes from one HTTP call:

```
POST /api/readings
{ spaceId, temperature, humidity, sound, light, occupiedSeats, totalSeats }
```

So the hardware job is: measure those six numbers in a room, and POST them
every minute. `studbud_sensor_node/studbud_sensor_node.ino` does exactly that
and compiles for the Arduino UNO R4 WiFi.

## Parts

| What | Part | Why this one |
| --- | --- | --- |
| Board | **Arduino UNO R4 WiFi** (or ESP32 DevKit / Nano 33 IoT) | WiFi on board — a classic UNO cannot POST anything without an extra shield |
| Temp + humidity | **DHT22** (AM2302) | ±0.5 °C / ±2 % RH, one data pin. DHT11 also works but is ±2 °C, too coarse for "is this room comfortable" |
| Light | **BH1750** (GY-302, I2C) | Reports real **lux**, which is what the score bands use. A bare photoresistor only gives "brighter/darker" |
| Sound | **MAX9814** or **MAX4466** mic amp (analog out) | Gives an audio envelope you can turn into dB. The cheap KY-038 with a pot is usable but drifts |
| Seats | VL53L0X time-of-flight, PIR, or a camera on a Pi | See "Counting people" below |
| Misc | Breadboard, jumpers, 10 kΩ resistor, USB-C cable, USB power bank | The pull-up is for the DHT22 data line |

Budget version: UNO R4 WiFi + DHT22 + BH1750 + MAX4466 is roughly $45 and is
enough for a full demo.

## Wiring

```
DHT22   data -> D2      (10 kΩ between data and 5V)
        VCC  -> 5V,  GND -> GND
BH1750  SDA  -> SDA,  SCL -> SCL
        VCC  -> 3V3, GND -> GND, ADDR -> GND
MAX4466 OUT  -> A0
        VCC  -> 3V3, GND -> GND
```

Use the analog (AO / envelope) pin of the sound module, not the digital one —
the digital pin is just a threshold "loud/not loud" gate.

## Flashing it

1. Install the [Arduino IDE 2](https://www.arduino.cc/en/software) and, in
   Boards Manager, the **Arduino UNO R4** core.
2. Library Manager → install *DHT sensor library*, *Adafruit Unified Sensor*,
   *BH1750*, *ArduinoJson*, *ArduinoHttpClient*.
3. `cp arduino_secrets_example.h arduino_secrets.h` and fill in your WiFi and
   the server address. On a laptop, that address is the laptop's LAN IP
   (`ipconfig` / `ifconfig`), not `localhost` — `localhost` on the Arduino
   means the Arduino.
4. Edit `SPACE_ID`, `SPACE_NAME`, `SPACE_BUILDING` and `TOTAL_SEATS` at the top
   of the sketch: one node per room, each with its own `SPACE_ID`.
5. Upload, then open Serial Monitor at 115200 baud. You want to see
   `post: 201`. `401` means the token doesn't match the server's
   `STUDBUD_INGEST_TOKEN`; a timeout usually means a firewall on the laptop or
   a campus WiFi that isolates clients (phone hotspot is the classic fix).

Check it end to end with curl before you blame the wiring:

```bash
curl -X POST http://<server>:3000/api/readings \
  -H "authorization: Bearer $STUDBUD_INGEST_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"spaceId":"test-room","name":"Test","temperature":21,"humidity":40,
       "sound":35,"light":400,"occupiedSeats":3,"totalSeats":20}'
```

## Calibrating the microphone

The mic gives ADC counts, not decibels. Two constants in the sketch turn one
into the other:

1. In a quiet room, watch the peak-to-peak swing printed by `readSoundDb()`
   (add a `Serial.println(swing)` while calibrating). Put that number in
   `SOUND_QUIET_COUNTS`, and the dB your phone's SPL meter app shows (~30-35 dB)
   in `SOUND_DB_AT_QUIET`.
2. Make a steady noise (music, a fan), note the new swing and the phone's dB.
   `SOUND_DB_PER_COUNT = (dB_loud - dB_quiet) / (swing_loud - swing_quiet)`.

Three points across quiet/medium/loud is plenty. Say in your demo that it is
calibrated against a phone SPL meter — judges like a number with a known
provenance more than a number that is secretly arbitrary.

Same idea for lux: BH1750 is already calibrated, but sanity-check it (a dim
room ≈ 100 lux, an office ≈ 400, next to a window ≈ 1000+) so the score bands
in `src/lib/score.ts` match your rooms.

## Counting people

`occupiedSeats` is the hardest number and the one that sells the project.
Options, cheapest first:

- **Doorway counter** — a VL53L0X (or two, to get direction) on the door frame
  counting entries and exits. Cheap, but drift accumulates; reset the count
  nightly or when the room is known empty.
- **Per-table sensors** — one VL53L0X or PIR per table reporting "taken".
  Accurate, does not scale past a few tables.
- **Robot dog camera** — the dog walks the room, runs a person detector
  (YOLO / MediaPipe on the companion laptop) on each frame, and reports the
  max count per sweep. This is where the dog earns its place: it gives you
  ground truth that resets the doorway counter's drift.

Whatever you pick, the dog just POSTs the same JSON — see below.

## The robot dog side

Anything that can make an HTTP request can be a sweeper. From the dog's
onboard computer (Unitree Go1/Go2, Boston Dynamics Spot SDK, or a laptop
following it around):

```python
import requests, os

requests.post(
    "http://studbud.local:3000/api/readings",
    headers={"Authorization": f"Bearer {os.environ['STUDBUD_INGEST_TOKEN']}"},
    json={
        "spaceId": "barker-dome",
        "temperature": 20.4, "humidity": 38, "sound": 41, "light": 860,
        "occupiedSeats": people_detected, "totalSeats": 45,
    },
    timeout=5,
)
```

A good division of labour: the Arduino nodes sit in rooms and report
environment continuously; the dog patrols, corrects the seat counts, and
covers rooms with no node in them. The dashboard marks any room whose last
sweep is older than 45 minutes as stale, so a patrol route of under 45 minutes
keeps every card live.

## What to learn (in this order)

1. **Arduino basics** — [the official Language Reference](https://docs.arduino.cc/language-reference/)
   and the built-in Examples (Blink, AnalogReadSerial). An hour gets you to
   "I can read a pin".
2. **Each sensor's example sketch** — every library above ships one under
   *File → Examples*. Get each sensor printing plausible values on its own
   before combining them; debugging three sensors at once is misery.
3. **WiFi + HTTP** — the *WiFiS3 → WiFiWebClient* example, then the
   ArduinoHttpClient POST example. The concept to hold onto is that your board
   is just another HTTP client, like curl.
4. **I2C vs analog vs digital** — Adafruit's
   [I2C guide](https://learn.adafruit.com/working-with-i2c-devices) explains
   why BH1750 needs two shared wires while the mic needs its own analog pin.
5. **Sensor calibration** — the idea that a raw ADC count means nothing until
   you map it to a physical unit against a reference. This is the single thing
   that most distinguishes a hackathon sensor project that judges believe from
   one they don't.
6. **Power** — a USB power bank runs a node for a day; if you want longer, read
   about deep sleep on the ESP32 (the UNO R4 is not great at low power).

## Demo-day checklist

- Bring a phone hotspot; campus WiFi blocks device-to-device traffic.
- Know each node's `spaceId` and have curl ready to fake a sweep if a sensor
  dies mid-pitch.
- Set `STUDBUD_INGEST_TOKEN` on the server *and* in `arduino_secrets.h`, and
  show a `401` on an unauthenticated POST — "anyone could spoof our rooms" is
  an easy question to pre-empt.
- Let a room actually get loud during the demo and watch the card re-rank; a
  live number changing beats any slide.
