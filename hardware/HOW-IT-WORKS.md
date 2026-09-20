# How the Arduino side works, line by line

This page is for understanding, not for copying. By the end you should be able
to change the firmware, debug it when a number looks wrong, and explain every
part of it to a judge.

Everything the server needs is six numbers and one HTTP request. That is the
whole contract:

```json
{ "spaceId": "...", "temperature": 21.4, "humidity": 42, "sound": 34, "light": 520 }
```

Seat counts are optional (the robot dog sends those separately). The
[test bench page](../src/app/test/page.tsx) at `/test` posts exactly this shape,
so you can prove the server works before any hardware exists.

---

## 1. The UNO Q is two computers in one board

This is the single most important thing to understand, and it's the part most
people get wrong.

| | Runs | Good at | Bad at |
| --- | --- | --- | --- |
| **MCU** — STM32U585 | your `.ino` sketch | exact timing, reading sensors, never being interrupted | networking, filesystems |
| **MPU** — Qualcomm QRB2210 | Debian Linux + Python | WiFi, HTTP, TLS, JSON, retries | microsecond-accurate sampling |

They talk over the **Bridge**, an RPC channel Arduino provides. The sketch says
"here is a sample"; Python decides what to do with it.

```
[DHT22, BH1750, mic] --wires--> MCU (sketch.ino) --Bridge--> Linux (main.py) --WiFi--> /api/readings
```

Why split it at all? Because `analogRead` in a tight one-second loop must not be
paused by a WiFi stack retransmitting a packet, and an HTTP retry must not stop
you from sampling. Separating them means a network outage costs you latency, not
data.

A classic Arduino (UNO R4 WiFi, ESP32) has no Linux side, so it does both jobs in
one sketch — that's `studbud_sensor_node/studbud_sensor_node.ino`. Same six
numbers, same POST.

---

## 2. Each sensor, and why it was chosen

### DHT22 — temperature and humidity (digital, one-wire)

```cpp
static DHT dht(DHT_PIN, DHT_TYPE);   // D2
float temperature = dht.readTemperature();
```

The DHT22 doesn't use a bus standard. It has one data pin, and the sensor encodes
bits as pulse *lengths* — the library counts microseconds to tell a 0 from a 1.
Two consequences you will actually hit:

- **It is slow.** Ask for a reading more than about every 2 seconds and you get
  the old one, or `NAN`. That's why `loop()` ends with `delay(2000)`.
- **A failed read returns `NAN`**, not 0. Never send `NAN` onward and never
  substitute 0 — 0 °C is a plausible-looking lie. The sketch keeps the last good
  value; Python drops the sample if a sensor has never answered:

```cpp
if (!isnan(temperature)) lastTemperature = temperature;
```

DHT11 (the blue one) is the cheaper sibling: ±2 °C and whole-number humidity.
The score bands here are 4.5 °C wide, so a ±2 °C sensor would decide the verdict
by itself. Hence the DHT22.

### BH1750 — light (digital, I²C)

```cpp
Wire.begin();
lightReady = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
float lux = lightMeter.readLightLevel();
```

I²C is a two-wire bus (SDA = data, SCL = clock) where every device has an
address, so several sensors share the same two pins. The BH1750 returns **lux**
directly — a real photometric unit, already weighted for how the human eye
responds to different colours.

The alternative, a photoresistor (LDR) on an analog pin, returns "some voltage"
that depends on the resistor you paired it with, the sensor's age and the colour
of the light. You cannot say "this room has 520 lux" with an LDR without
calibrating against a real light meter. Since the score has a hard band at
300–800 lux, the unit has to mean something. Hence the BH1750.

`lightMeter.begin()` returning false means the bus is wrong: check SDA/SCL and
that ADDR is pulled to GND.

### Electret microphone + MAX4466/MAX9814 — noise (analog)

This is the only sensor doing real signal processing, and the only one you must
calibrate. Read this section twice.

A microphone outputs an *alternating* voltage that swings above and below a
mid-rail bias (~1.65 V on a 3.3 V board). Its average is always the bias, no
matter how loud the room is. So this is wrong:

```cpp
int loudness = analogRead(MIC_PIN);   // ✗ tells you almost nothing
```

You have to measure the **amplitude of the swing**, which means watching for a
while and taking max minus min:

```cpp
const unsigned long window = 1000;         // one second
while (millis() - start < window) {
  int sample = analogRead(MIC_PIN);
  if (sample < low)  low  = sample;
  if (sample > high) high = sample;
}
float swing = (float)(high - low);         // peak-to-peak, in ADC counts
```

One second is a deliberate choice: long enough to catch a spoken syllable or a
chair scrape, short enough to still be "now".

Then counts become decibels:

```cpp
return SOUND_DB_AT_QUIET + (swing - SOUND_QUIET_COUNTS) * SOUND_DB_PER_COUNT;
```

**This is a two-point linear fit, and the constants in the file are placeholders.
Yours will differ** — they depend on your mic module, its gain setting and your
board's 3.3 V ADC reference. Calibrating it is the single highest-value hour you
can spend on this project, because it's the difference between "our sensor says
34" and "our sensor says 34 dB and here's the SPL meter agreeing".

How to do it:

1. Install a sound-level meter app on your phone (they're roughly accurate in the
   40–80 dB range, which is exactly the range that matters here).
2. Print `swing` to the Monitor instead of dB.
3. In a quiet room, write down the pair: `swing` and the app's dB. That's
   `SOUND_QUIET_COUNTS` and `SOUND_DB_AT_QUIET`.
4. Play music / talk until the app reads ~70 dB. Write down that pair too.
5. `SOUND_DB_PER_COUNT = (dB₂ − dB₁) / (swing₂ − swing₁)`.
6. Put all three numbers in the sketch, then check a third, middle condition to
   see whether the line holds.

Real dB is logarithmic in pressure, so a straight line is an approximation. Over
the 30–75 dB range with the mic's own log-ish amplifier it's close enough, and
being explicit about that in your write-up reads as competence, not a weakness.

**Why the peak, not the average?** Look at `main.py`:

```python
"sound": round(max(s[2] for s in batch), 1),   # noise: max
"temperature": round(sum(s[0] for s in batch) / count, 1),   # everything else: mean
```

A room with one loud conversation every 30 seconds averages out to "quiet" but is
impossible to work in. Temperature genuinely is an average; noise is about the
worst it gets.

---

## 3. The sketch, top to bottom

```cpp
void setup() {
  Monitor.begin();   // App Lab's console — like Serial, but it goes over the Bridge
  Bridge.begin();    // opens the RPC channel to the Linux side
  dht.begin();
  Wire.begin();      // I²C
  lightReady = lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE);
}
```

Use `Monitor`, not `Serial`, and never open `Serial1`/`/dev/ttyHS1` yourself — on
the UNO Q that link *is* the Bridge, and grabbing it breaks the connection
between the two halves of the board.

```cpp
void loop() {
  // ...read sensors, keep last good values...
  Bridge.notify("sample", lastTemperature, lastHumidity, sound, lastLight);
  delay(2000);
}
```

`Bridge.notify` is fire-and-forget: the MCU doesn't wait for Linux to answer. The
matching line in Python is:

```python
Bridge.provide("sample", on_sample)
```

Bridge messages cap out at 256 bytes, which four floats sit comfortably inside.
If you ever need a callback that touches Arduino APIs, register it with
`Bridge.provide_safe` instead.

---

## 4. The Python side, and the two bugs worth understanding

```python
def loop() -> None:
    if now - last_post < POST_INTERVAL:   # once a minute, not every sample
        time.sleep(1)
        return
```

Sampling every 2 s but posting every 60 s means each POST carries ~30 samples
averaged together, which smooths sensor jitter and keeps the server's history at
a sane resolution.

Two subtle things in that file, both worth being able to explain:

**Don't drop data on a failed POST.** The obvious version clears the buffer and
then sends, so a WiFi hiccup silently deletes a minute of measurements. The fix
is to only discard what the server accepted:

```python
batch = samples[:]
del samples[:count]          # detach before the blocking request
if not post(payload):
    samples[:0] = batch      # put it back if the POST failed
    del samples[:-MAX_SAMPLES]
```

**Detach *before* the request, not after.** `on_sample` keeps running during the
POST (it's driven by the Bridge, not by `loop`). Deleting "the first N entries"
after a 5-second request would delete samples that arrived *during* it.

`MAX_SAMPLES = 300` bounds the buffer at ~10 minutes, so a server that stays down
overnight doesn't slowly eat the board's RAM.

---

## 5. Bringing it up, in the order that finds bugs fastest

Never wire all three sensors and flash the full app first — when nothing works
you won't know which of five things is wrong.

1. **Server alone.** Open `/test`, send the four default values, confirm `201`.
   No hardware involved yet.
2. **One sensor, alone.** Load the DHT22 library's own example. Get plausible
   numbers on the Monitor. Breathe on it — humidity should jump.
3. **Second sensor, alone.** BH1750 example. Cover it with your hand; cover it
   and shine a phone torch. Roughly: dim room ~100 lux, office ~400, by a window
   ~2000+.
4. **Mic, alone.** Print `swing`. Clap. Then calibrate (section 2).
5. **All three in this sketch**, still printing to the Monitor only.
6. **Add the network.** Fill in `/home/arduino/studbud.json`, run the app, watch
   for `post 201` in the console.
7. **Unplug your router mid-run** and confirm the samples come back when it
   returns. That's the failure you'll be asked about.

Wiring, parts and the config file live in
[`studbud_uno_q_app/README.md`](studbud_uno_q_app/README.md). Remember: UNO Q
headers are 3.3 V and the analog pins are **not** 5 V tolerant — power every
sensor from `3V3`.

---

## 6. Where to learn more

- **Arduino's own sensor pages** for the DHT and BH1750 libraries — read the
  example sketches, they're short and they're the ground truth for the API.
- **I²C**: understand address, SDA/SCL and pull-ups. `i2cdetect`-style scanner
  sketches are the fastest way to debug "sensor not found".
- **ADC and sampling**: what "10-bit vs 12-bit" and "reference voltage" mean, and
  why peak-to-peak is the right measure for an AC signal.
- **dB SPL**: why it's logarithmic and why 60 dB is not "twice" 30 dB.
- **Arduino App Lab docs** for the UNO Q: the Bridge, `app.yaml`, and how the
  sketch and Python app are deployed together.

Good questions to be able to answer, because they're the ones you'll get asked:

- Why is your noise number the maximum and not the mean?
- How do you know 34 really is 34 dB?
- What happens if the WiFi drops for ten minutes?
- What stops a stale reading from being presented as current? (That one is the
  server's job: 45 minutes without a sweep and the room stops being scored.)
