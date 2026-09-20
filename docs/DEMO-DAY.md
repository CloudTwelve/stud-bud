# Stud-Bud: The Campaign Guide

Two things live here:

1. **The Campaign** — the order to read this codebase in, as a set of quests, so
   you can present it without hand-waving.
2. **The Endgame** — what to actually change when the real board and the Go2 are
   ready, and how to get the fake rooms off the screen.

Nothing here is required to run the app. It is a map.

---

# Part I — The Campaign

Rules of the game: read in order, and after each quest answer the **boss
question** out loud. If you can't, re-read that one file — don't move on. The
whole campaign is about 90 minutes at a normal pace, ~40 if you skim the side
quests.

Your character sheet: one number, say `34.2` dB measured in a library at
11:04 PM. Every quest follows that number one step further.

---

## Level 1 — The Pitch (5 min)

**Read:** `README.md`

The elevator version: rooms have qualities you can't see from the door (is it
loud, is it stuffy, are there seats), sensors can measure them, so measure them
and rank the rooms.

**Boss question:** what problem does this solve that a photo of the room
wouldn't?

---

## Level 2 — The Shape of a Reading (10 min)

**Read:** `src/lib/types.ts`, then `src/lib/validate.ts`

`types.ts` is the contract for the entire project — every layer, hardware
included, agrees on this shape. Five numbers plus an id:

```ts
{ spaceId, temperature, humidity, sound, light, occupiedSeats?, totalSeats? }
```

`validate.ts` is the bouncer. Note that the seat fields are optional **as a
pair** — you send both or neither. That one decision is what lets two different
machines (an Arduino that knows nothing about seats, a robot dog that knows
nothing about temperature) report on the *same* room without stepping on each
other.

**Boss question:** why are `occupiedSeats` and `totalSeats` optional, and why
must they travel together?

---

## Level 3 — The Front Door (10 min)

**Read:** `src/app/api/readings/route.ts`, then `src/lib/auth.ts`

`POST` = a machine telling the server something. `GET` = a browser asking. That
is the entire API surface for readings, and it's deliberately small: anything
that can make an HTTP request can be a sensor node. `curl` can be a sensor node
— that's what `/test` exploits.

`auth.ts` is eleven lines: if `STUDBUD_INGEST_TOKEN` is set, a matching bearer
token is required. Unset means open ingest, which is fine on a laptop and not
fine on the internet.

**Boss question:** what stops a stranger from posting fake readings to your
demo?

---

## Level 4 — Memory (15 min) ⭐ the one people skip

**Read:** `src/lib/store.ts`, then `src/lib/backend.ts`, then `src/lib/seed.ts`

`store.ts` is the app's vocabulary: `recordReading`, `listSpaces`, `getSpace`,
`isStale`. `backend.ts` is where the rows actually live — SQLite normally,
an in-memory map if SQLite can't load (a deploy target without native modules,
for instance). The app above never knows which one it got.

Two details worth stealing for the presentation:

- **Staleness** (`STALE_AFTER_MINUTES = 45`): a room whose last sweep is old is
  marked `stale` and the UI stops scoring it. Old data presented as current is
  worse than no data.
- **Carry-forward**: post temperature without seats and the last known seat
  count is reused. This is the other half of the Level 2 decision.

`seed.ts` is the honest one: **every room you have ever seen on the dashboard
came from here.** Five invented rooms, 24 hours of history at 20-minute
intervals, each value `baseline + busy × swing + jitter` where `busy` is a sine
curve peaking around midday. That's why the trends look like a day instead of
noise. It only runs when the store is empty.

**Boss question:** where does the number on the screen come from *today*, and
what exactly changes when a real board posts?

---

## Level 5 — The Judgement (15 min) ⭐ the interesting part

**Read:** `src/lib/score.ts`

This is the project's actual opinion and the thing to lead with when presenting.
`band()` scores one value 0–100: full marks inside a comfortable range, sloping
to zero at the unbearable bounds. Each metric gets a band, the bands get
weighted, the weighted mean is the room's score, and each metric also produces
a plain-English line so the score is explainable rather than magic.

The weights are where it stops being generic: `PRESETS` includes *I need
silence* (sound × 4) and *Just find me a seat* (occupancy × 4). Same sensor
data, different answer per person.

**Boss question:** two rooms both score 72. Why, and would you send the same
student to both?

---

## Level 6 — The Face (15 min)

**Read:** `src/app/page.tsx` → `src/components/Dashboard.tsx` →
`src/components/SpaceCard.tsx` → `src/components/SpaceDetail.tsx`

Landing page sells it, `/rooms` ranks them, `/space/[id]` is one room in depth
with `TrendChart.tsx` drawing 24 hours and calling the quietest hour.

**Side quest — the theme:** `src/app/globals.css` holds ~20 CSS variables.
No component names a colour; they say `var(--brand)` / `var(--accent)`. Open
devtools, edit `--accent` on `:root`, watch the whole site follow. Dark mode
swaps the variables, not the components.

**Boss question:** to make the site purple, how many files do you touch?

---

## Level 7 — Liveness (10 min)

**Read:** `src/lib/events.ts` → `src/app/api/stream/route.ts` →
`src/components/LiveFeed.tsx`

A reading arrives, the server emits an event, the stream pushes the room **id**
to every open browser, and the browser refetches that room. Note it pushes the
id and not the data — so a tab that just reconnected and a tab that's been open
an hour end up in the same state.

**Try it:** two tabs on `/test`, send a reading in one, watch the other move.

**Boss question:** why not push the reading itself down the stream?

---

## Level 8 — The Machines (20 min)

**Read:** `hardware/HOW-IT-WORKS.md` → `hardware/studbud_uno_q_app/README.md` →
`sketch/sketch.ino` → `python/main.py`

One sentence explains every strange thing about this board: **the UNO Q is two
computers.** A microcontroller that reads sensors on a precise schedule and is
bad at WiFi, and a Linux computer that is good at WiFi and bad at precise
timing. `Bridge` is the wire between them; App Lab is what makes the two halves
one app. That's also the answer to "why not the normal Arduino IDE".

The MCU samples every 2 s, Python averages a minute of samples and posts once.
Averaging is deliberate: one mic sample is a cough, sixty is a room.

**Boss question:** why is there a `python/` folder inside an Arduino project?

---

## Boss Fight — The Demo

Told as one sentence per step, no notes:

> A mic and a temperature sensor are read by a microcontroller every two
> seconds. It hands its readings to the Linux side of the same board, which
> averages a minute of them and POSTs one JSON object to our server. The server
> validates it, stores it, scores each quality against what's comfortable for
> studying, weights those by what *you* care about, and pushes the update to
> every open browser — so the ranking on your phone is what the room is like
> right now, and it can tell you *why*.

Then the questions to have an answer ready for:

- *What if the sensor dies mid-demo?* → staleness; we say "no recent data"
  rather than showing you a stale score.
- *Are the dB numbers real?* → this is the one that needs you: calibrate the mic
  against a phone SPL meter and be able to say by how much you corrected it.
- *Why HTTP instead of Bluetooth?* → anyone on the network can see it, no
  pairing, and the phone in the judge's hand doesn't need to be near the board.
- *Could this scale to a whole campus?* → the server doesn't know how many nodes
  exist; a new room is just a new `spaceId` posting.

---

# Part II — The Endgame (going live)

The good news is the server needs **no code changes** to take real data. That
was the point of designing around one HTTP endpoint. What follows is
configuration and discipline.

## Step 1 — One real room, one real board

1. Laptop and board on the same network (phone hotspot is fine and usually
   easiest). Get the laptop's LAN IP: `ipconfig getifaddr en0`.
2. On the board, `/home/arduino/studbud.json`:
   ```json
   {
     "url": "http://<laptop-lan-ip>:3000/api/readings",
     "token": "<same as STUDBUD_INGEST_TOKEN on the laptop>",
     "spaceId": "hayden-reading-room",
     "name": "Hayden Reading Room",
     "building": "Building 14"
   }
   ```
   Not `localhost` — on the board that means the board.
3. Run. Success looks like `post: 201` roughly once a minute, and the room
   appearing in the live section of `/test`.

`spaceId` is the join key for everything that follows. Pick the real ones now
and write them down: lowercase, hyphenated, stable.

**Don't send `recordedAt`.** The UNO Q has no battery-backed clock; if it boots
without network time it will date readings wrong and stale data will look fresh.
Omit the field and the server timestamps on arrival.

## Step 2 — The Go2

The dog posts to the *same* endpoint with the *same* `spaceId`, but only the
occupancy half:

```json
{ "spaceId": "hayden-reading-room", "occupiedSeats": 31, "totalSeats": 60 }
```

Wait — validation requires the four environmental fields. So there are two
honest options, and which one you pick is a design decision worth stating in the
presentation:

- **A (no server change):** the dog's script GETs `/api/readings`, takes the
  room's latest environmental values, and reposts them with its own seat counts.
  Simple, no code from us, but it copies numbers it didn't measure.
- **B (small server change):** make the environmental fields optional the same
  way the seat fields already are, and carry *them* forward instead. This is the
  symmetric version of the Level 2 decision and is maybe twenty lines in
  `validate.ts` + `store.ts`. Ask and it gets done.

Either way, the counting is the hard part, not the posting. Two paths depending
on how much time is left:

- **Autonomous:** frames off the Go2 (SDK over its network, or an onboard
  camera), a person detector, count heads per patrol point, POST.
- **Teleop (much more likely to survive a stage):** the dog patrols, a human
  watches the stream and sets a seat count with a slider/keypress that POSTs.
  Be upfront that it's human-in-the-loop; nobody minds, and it demos reliably.

Whichever you pick, the dog's node needs the same bearer token.

## Step 3 — Killing the fake rooms

Two switches, use both:

1. Run the server with `STUDBUD_NO_SEED=1`. This stops `seedIfEmpty()` from
   ever inventing rooms again, including after a database wipe.
2. Delete the existing demo data once: stop the server, remove `.data/studbud.db`
   (or whatever `STUDBUD_DB` points at), start it again. The flag alone doesn't
   remove rows that are already there.

Then post one real reading before anyone looks at it — with no seed and no data,
the dashboard is legitimately empty.

Keep the demo path alive as insurance: unset the flag with a fresh database and
you're back to five plausible rooms in seconds. If the hardware dies ten minutes
before judging, that's your parachute — just say out loud that it's simulated
data.

## Step 4 — More rooms

Nothing new to learn: another node with another `spaceId`, or the same node
carried to another room with `studbud.json` edited. The server creates rooms on
first post.

Two gotchas at multi-room scale: a node posting to the wrong `spaceId` silently
corrupts a room's history (typos in `spaceId` create a *new* room rather than
erroring, which is the tradeoff of create-on-post), and rooms nobody is
measuring go stale after 45 minutes and drop out of scoring — which is correct
behaviour, not a bug, but explain it before a judge notices it.

## Step 5 — Before you present

- [ ] Mic calibrated against a phone SPL meter, correction noted.
- [ ] Lux sanity-checked (dark room, lit room) — bands assume ~300–800 lux.
- [ ] `totalSeats` matches the seats actually in the room.
- [ ] `STUDBUD_INGEST_TOKEN` set, and the same value on every node.
- [ ] `STUDBUD_NO_SEED=1` and the database wiped.
- [ ] One end-to-end run watched: sensor → `post: 201` → room moves in a browser
      that was already open.
- [ ] Backup plan rehearsed (seeded demo, and a phone hotspot if the venue WiFi
      is hostile).

The demo moment is a browser open on the projector, someone talks loudly next to
the board, and the score drops within a minute. Practise that once.
