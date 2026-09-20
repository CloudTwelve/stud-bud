# Stud-Bud sensor node (Arduino UNO Q)

An Arduino App Lab app that reads a room's temperature, humidity, noise and
light on the UNO Q's microcontroller and posts a sweep to the Stud-Bud
dashboard from the board's Linux side — no bridge laptop, no WiFi shield.

```
sketch/sketch.ino   MCU (STM32U585): DHT + Modulino Light + mic, one sample every 2 s
python/main.py      Linux (QRB2210): averages samples, POSTs /api/readings once a minute
```

The two halves talk over the App Lab Bridge (`Bridge.notify` → `Bridge.provide`),
so nothing in this app opens a serial port itself.

## Wiring

The UNO Q headers are **3.3 V** and the analog pins are **not 5 V tolerant** —
power every sensor from `3V3`, never from `5V`.

```
Modulino Light  Qwiic cable -> the board's Qwiic socket (no soldering, no pins)
DHT11/DHT22     data -> D2      (10 kΩ between data and 3V3)
                VCC  -> 3V3, GND -> GND
MAX4466         OUT  -> A0
                VCC  -> 3V3, GND -> GND
```

The Qwiic socket is the UNO Q's *second* I2C bus (`Wire1`, 3.3 V only). The
Modulino library already knows that on this board, so `Modulino.begin()` needs
no arguments. Modulinos daisy-chain: if you add a Modulino Thermo later you can
plug it into the free Qwiic socket on the Light node and drop the DHT22.

The Light node is an LTR-381RGB behind a small microcontroller. `light.update()`
fetches one measurement, then `light.getLux()` is the ambient level in lux
(`getAL()` is the *raw* unscaled count and `getIR()` is infrared — this app only
wants lux).

## Flashing it, step by step

The UNO Q is two computers in one, so "flashing" here means *building the sketch
for the microcontroller and starting the Python side next to it* — App Lab does
both when you press Run. You never drag a `.hex` file anywhere.

1. **Power the board.** USB-C from your laptop to the board's USB-C port. The
   Linux side takes ~30 s to boot; the green LED settles when it is up.
2. **Open App Lab.** Install [Arduino App Lab](https://www.arduino.cc/en/software)
   on your laptop and open it. The board shows up in the top bar as *UNO Q*
   once it has booted — if it doesn't, try the other USB-C cable (many cheap
   cables are charge-only and carry no data).
3. **Get this folder onto the board.** Either copy the whole
   `studbud_uno_q_app` folder to the board over USB/SSH, or in App Lab choose
   *Import App* and point it at the folder on your laptop. The layout already
   matches the
   [Arduino App specification](https://github.com/arduino/arduino-app-cli/blob/main/docs/app-specification.md),
   so App Lab recognises it as an app rather than a loose sketch.
4. **Let it install the libraries.** Open the sketch inside App Lab; it reads
   `sketch/sketch.yaml` and offers to install `DHT sensor library`,
   `Adafruit Unified Sensor` and `Arduino_Modulino`. Say yes. The first install
   takes a minute or two. `Arduino_RouterBridge` already ships with the core.
5. **Plug the sensors in** as in the wiring block above. Do this with the board
   powered off if you're moving jumper wires; the Qwiic cable is safe to plug in
   live.
6. **Create `python/studbud.json`** in the app (step below) so the Python side
   knows where to POST.
7. **Press Run.** App Lab compiles the sketch, loads it onto the STM32
   microcontroller, and starts `python/main.py` on the Linux side. Expect
   30–60 s the first time.
8. **Watch two windows.** The MCU monitor prints `t= h= dB= lux=` every two
   seconds — that tells you the sensors work. The Python console prints
   `post: 201` once a minute — that tells you the network works. If the first
   one is fine and the second isn't, the problem is the URL or the token, not
   the wiring.

Re-flashing after an edit is just pressing Run again; it replaces what's on the
MCU. Nothing you do here can brick the board.

### If a library is missing

`fatal error: Arduino_Modulino.h: No such file or directory` means step 4 was
skipped or declined — the header ships with a library, not with the core. Fix it
in *Library Manager* (the books icon): search `Modulino`, install
**Arduino_Modulino** by Arduino, version 0.9.1. The same applies to
`DHT.h` (`DHT sensor library` by Adafruit, which also pulls in
`Adafruit Unified Sensor`).

A missing header from *inside* a library — `vl53l4cd_class.h`,
`Arduino_LSM6DSOX.h` and friends — is a different problem. `Arduino_Modulino.h`
includes the driver for every Modulino node, so all of them must be present even
though only Light is wired up, and a profile build installs exactly what
`sketch/sketch.yaml` lists and resolves no dependencies of its own. The fix is
always to add the missing library, with a version, to that list.

If you're compiling from a **downloaded zip in Arduino IDE 2** rather than
importing the folder into App Lab, expect this error every time — IDE 2 never
reads `sketch/sketch.yaml`, so nothing gets installed for you. It also can't run
the Python half, and `Arduino_RouterBridge` is only present when the sketch is
built for the UNO Q through App Lab. Use App Lab's *Import App* on the
`studbud_uno_q_app` folder instead.

## Configuration

Create `studbud.json` **next to the app**, at
`~/ArduinoApps/studbud_uno_q_app/python/studbud.json` on the board. It is
gitignored, so the token never ends up in git:

```json
{
  "url": "http://192.168.1.42:3000/api/readings",
  "token": "the same value as STUDBUD_INGEST_TOKEN on the server",
  "spaceId": "hayden-reading-room",
  "name": "Hayden Reading Room",
  "building": "Building 14"
}
```

The Python half runs in a container, so `/home/arduino` as seen by the app is
not the `/home/arduino` an App Lab terminal writes to — a config written there
can be invisible to the running app. The app directory is shared, so keeping the
file beside `main.py` always works; `/home/arduino/studbud.json` is still read
as a fallback. On startup the console prints which file it loaded and the URL it
will post to, so check that line before debugging the network. The file is read
once at startup: after editing it, press Stop then Run.

The address is the dashboard host's LAN IP (or the public site's `https://` URL),
not `localhost` — `localhost` from the board means the board itself. `STUDBUD_URL`, `STUDBUD_INGEST_TOKEN`,
`STUDBUD_SPACE_ID`, `STUDBUD_SPACE_NAME` and `STUDBUD_SPACE_BUILDING` override
the file if you prefer environment variables.

One app per room: give each board its own `spaceId`.

## When it doesn't work

| Symptom | Where to look |
| --- | --- |
| Board never appears in App Lab | charge-only USB-C cable, or Linux still booting |
| `Arduino_Modulino.h: No such file or directory` | the library isn't installed — see *If a library is missing* above |
| `vl53l4cd_class.h: No such file or directory` | a Modulino driver dependency is missing from `sketch.yaml` |
| `Library install failed: ... lookup downloads.arduino.cc` | the board has no working DNS; put it on a phone hotspot |
| `Modulino Light not found` | Qwiic cable not seated, or plugged into a Modulino's *output* socket |
| `lux=nan` forever | the node answered `begin()` but `update()` keeps failing — reseat the cable |
| `t=nan h=nan` | DHT pull-up resistor missing, or data on the wrong pin |
| `t=307.40 h=3807.00` or similar nonsense | `DHT_TYPE` doesn't match the part: blue body is `DHT11`, white is `DHT22` |
| `skipping sample: temperature=... is outside` | the same thing, caught before it reaches the dashboard |
| dB barely moves | mic gain pot turned down, or `OUT` not on A0 |
| Monitor fine, no `post:` | wrong URL/IP, server not running, or laptop firewall |
| `post failed: ...timed out` with a URL you never set | the config wasn't found — check the `config:` line printed at startup |
| `no url configured` | no `studbud.json` on any searched path |
| `post: 401` | the board's token and the server's `STUDBUD_INGEST_TOKEN` differ |

You can always check the server half without any hardware: open `/test` on the
dashboard and send four numbers by hand.

## Seat counts

This node reports environment only and leaves `occupiedSeats`/`totalSeats` out
of the payload, so the dashboard keeps whatever the robot dog last counted for
that room. Set them in `studbud.json` if this board is also the thing counting
people. The exception is a room the server has never seen: it has nothing to
carry forward, so the sweep that creates it must include seats too.

## Calibrating the microphone

`SOUND_QUIET_COUNTS`, `SOUND_DB_AT_QUIET` and `SOUND_DB_PER_COUNT` at the top of
the sketch map peak-to-peak ADC counts to decibels; see
[../README.md](../README.md) for the two-point procedure against a phone SPL
meter. Until you do that, the dB numbers are plausible but arbitrary.
