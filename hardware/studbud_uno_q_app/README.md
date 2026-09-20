# Stud-Bud sensor node (Arduino UNO Q)

An Arduino App Lab app that reads a room's temperature, humidity, noise and
light on the UNO Q's microcontroller and posts a sweep to the Stud-Bud
dashboard from the board's Linux side — no bridge laptop, no WiFi shield.

```
sketch/sketch.ino   MCU (STM32U585): DHT22 + BH1750 + mic, one sample every 2 s
python/main.py      Linux (QRB2210): averages samples, POSTs /api/readings once a minute
```

The two halves talk over the App Lab Bridge (`Bridge.notify` → `Bridge.provide`),
so nothing in this app opens a serial port itself.

## Wiring

The UNO Q headers are **3.3 V** and the analog pins are **not 5 V tolerant** —
power every sensor from `3V3`, never from `5V`.

```
DHT22   data -> D2      (10 kΩ between data and 3V3)
        VCC  -> 3V3, GND -> GND
BH1750  SDA  -> SDA, SCL -> SCL      (or just plug it into the Qwiic connector)
        VCC  -> 3V3, GND -> GND, ADDR -> GND
MAX4466 OUT  -> A0
        VCC  -> 3V3, GND -> GND
```

## Running it

1. Copy this folder onto the board (or import it in App Lab: *Import App* →
   pick the folder). The folder layout already matches the
   [Arduino App specification](https://github.com/arduino/arduino-app-cli/blob/main/docs/app-specification.md).
2. In App Lab, open the sketch and let it install the libraries listed in
   `sketch/sketch.yaml` (`DHT sensor library`, `Adafruit Unified Sensor`,
   `BH1750`). `Arduino_RouterBridge` ships with the core.
3. Create `/home/arduino/studbud.json` on the board — this file is **not** part
   of the app, so the token never ends up in git:

   ```json
   {
     "url": "http://192.168.1.42:3000/api/readings",
     "token": "the same value as STUDBUD_INGEST_TOKEN on the server",
     "spaceId": "hayden-reading-room",
     "name": "Hayden Reading Room",
     "building": "Building 14"
   }
   ```

   The address is the dashboard host's LAN IP, not `localhost` — `localhost`
   from the board means the board. `STUDBUD_URL`, `STUDBUD_INGEST_TOKEN`,
   `STUDBUD_SPACE_ID`, `STUDBUD_SPACE_NAME` and `STUDBUD_SPACE_BUILDING`
   override the file if you prefer environment variables.
4. Run the app. The App Lab console shows `post: 201` once a minute, and the
   MCU monitor shows the raw `t= h= dB= lux=` line every two seconds.

One app per room: give each board its own `spaceId`.

## Seat counts

This node reports environment only and leaves `occupiedSeats`/`totalSeats` out
of the payload, so the dashboard keeps whatever the robot dog last counted for
that room. Set both `totalSeats` and `occupiedSeats` in `studbud.json` if this
board is also the thing counting people — the server needs either both or
neither.

## Calibrating the microphone

`SOUND_QUIET_COUNTS`, `SOUND_DB_AT_QUIET` and `SOUND_DB_PER_COUNT` at the top of
the sketch map peak-to-peak ADC counts to decibels; see
[../README.md](../README.md) for the two-point procedure against a phone SPL
meter. Until you do that, the dB numbers are plausible but arbitrary.
