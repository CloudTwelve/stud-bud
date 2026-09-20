# Live demo: getting Stud 5 Lounge (W20) on the board

`/rooms` has three tabs. **Cards** and **Map** are the idealized campus — seeded
rooms that show what the product looks like fully deployed. The third tab,
**Stud 5 Lounge (W20)**, is the room you are actually testing in: it is never
seeded, so it shows an empty "waiting for the first sweep" state until your
hardware posts, and real numbers the second it does.

The room is identified everywhere by one id:

```
spaceId: stud-5-lounge
name:    Stud 5 Lounge
building: W20
```

Post with that id and the tab fills in. Post with any other id and you have
created a different room, which will show up on the Cards tab instead — that
mismatch is the most common mistake here.

---

## 1. Put the server somewhere both devices can reach

On your laptop:

```bash
npm run dev                 # serves on :3000
ipconfig getifaddr en0      # macOS: your LAN IP, e.g. 192.168.1.42
```

Board, dog, and laptop must be on the **same network** (a phone hotspot is
fine, and usually easier than campus WiFi). `localhost` on the board means the
board, so always use the laptop's IP.

If you set an ingest token on the server (`STUDBUD_INGEST_TOKEN=...`), every
POST must carry `Authorization: Bearer <token>`. If you didn't, skip the token
everywhere below.

Prove the path before touching hardware:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<laptop-ip>:3000/api/readings
```

`200` from another device on the network means you're clear; anything else is
almost always your laptop's firewall blocking port 3000.

## 2. Arduino UNO Q — temperature, humidity, sound, light

Create `/home/arduino/studbud.json` on the board (App Lab terminal):

```json
{
  "url": "http://<laptop-ip>:3000/api/readings",
  "token": "",
  "spaceId": "stud-5-lounge",
  "name": "Stud 5 Lounge",
  "building": "W20"
}
```

Press **Run**. Two consoles tell you where you are:

- MCU monitor shows `t= h= dB= lux=` every 2s → sensors work.
- Python console shows `post: 201 stud-5-lounge` about once a minute → the
  server took it, and the tab is now live.

`nan` in the MCU line is wiring, not networking — the symptom table in
`hardware/studbud_uno_q_app/README.md` maps each one. A `post failed` line with
the numbers still scrolling is networking: wrong IP, different network, or the
firewall.

Note the sketch posts once a minute, not once per sample: a room's usefulness
doesn't change in two seconds, and one request a minute is kinder to both the
battery and the demo WiFi.

## 3. Unitree Go2 — seats

The dog owns `occupiedSeats` / `totalSeats` for the same `spaceId`. One
important constraint today: **ingest requires the four environmental fields**,
so a seats-only POST is rejected. Two ways around it, pick either:

**a) Echo the current values back** (no code changes from me). Read the room,
then post seats alongside what's already there:

```bash
ROOM=http://<laptop-ip>:3000/api/spaces/stud-5-lounge
curl -s $ROOM | python3 -c '
import json,sys
r = json.load(sys.stdin)["space"]["latest"]
print(json.dumps({
  "spaceId": "stud-5-lounge",
  "temperature": r["temperature"], "humidity": r["humidity"],
  "sound": r["sound"], "light": r["light"],
  "occupiedSeats": 6, "totalSeats": 18,
}))' | curl -s -X POST http://<laptop-ip>:3000/api/readings \
  -H 'content-type: application/json' --data-binary @-
```

Swap `6` for whatever your seat detection counts, and run it on each sweep.

**b) Tell me and I'll make the environmental fields optional** with
carry-forward, exactly like the seat fields already work (~20 lines). Then the
dog posts `{spaceId, occupiedSeats, totalSeats}` and nothing else.

Until the dog posts once, the tab shows the room with no seat count rather than
a guess.

## 4. Checks and fallbacks

```bash
# every room the server knows about, newest reading first
curl -s http://localhost:3000/api/readings | python3 -m json.tool | head -40
```

- **Room appears on the wrong tab** → the `spaceId` isn't `stud-5-lounge`.
- **`401`** → server has a token, your POST doesn't (or they differ).
- **`400`** → a field is missing or not a number; the response body says which.
- **Tab says "Stale"** → nothing has posted for a while; the numbers are kept
  but explicitly distrusted rather than shown as current.
- **Hardware dies mid-demo** → the Cards and Map tabs are unaffected; they're
  seeded and will keep working. That separation is the whole point of putting
  the live room on its own tab.

`/test` can post a sweep as any room, including this one, if you want to
rehearse the tab's behaviour without the board.
