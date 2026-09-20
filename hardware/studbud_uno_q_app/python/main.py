"""Stud-Bud sensor node - Linux side (Arduino UNO Q).

Receives one sample every couple of seconds from the sketch over the Bridge,
averages them, and POSTs a sweep to the Stud-Bud dashboard once a minute.

Configuration lives outside the app so no room names, hostnames or tokens are
committed: create /home/arduino/studbud.json (see hardware/README.md) or set
the STUDBUD_* environment variables.
"""

import json
import math
import os
import time
from pathlib import Path

import requests
from arduino.app_utils import App, Bridge

# The app runs in a container, so /home/arduino here is not the /home/arduino a
# terminal writes to. The app directory is shared either way, so a config placed
# beside the app is the one that always works.
CONFIG_PATHS = [
    Path(os.environ["STUDBUD_CONFIG"]) if os.environ.get("STUDBUD_CONFIG") else None,
    Path(__file__).resolve().parent / "studbud.json",
    Path(__file__).resolve().parent.parent / "studbud.json",
    Path("/home/arduino/studbud.json"),
]
POST_INTERVAL = 60.0  # seconds
# Same bounds the server enforces, in the order the sketch sends them.
RANGES = (
    ("temperature", -20.0, 60.0),
    ("humidity", 0.0, 100.0),
    ("sound", 0.0, 160.0),
    ("light", 0.0, 150000.0),
)
# ~10 minutes of samples: enough to ride out a short outage without the buffer
# growing forever while the server is down.
MAX_SAMPLES = 300


def load_config() -> dict:
    config = {
        "url": "",
        "token": "",
        "spaceId": "stud-5-lounge",
        "name": "Stud 5 Lounge",
        "building": "W20",
        # Leave seats out entirely when this node does not count people: the
        # dashboard keeps whatever the robot dog last reported for the room.
        # A room the server has never seen is the exception - it has nothing to
        # keep, so one client has to report seats before the rest can omit them.
        "totalSeats": None,
        "occupiedSeats": None,
    }
    source = "no file, looked in " + ", ".join(
        str(p) for p in CONFIG_PATHS if p is not None
    )
    for path in CONFIG_PATHS:
        if path is not None and path.is_file():
            config.update(json.loads(path.read_text()))
            source = str(path)
            break
    overridden = []
    for key, env in (
        ("url", "STUDBUD_URL"),
        ("token", "STUDBUD_INGEST_TOKEN"),
        ("spaceId", "STUDBUD_SPACE_ID"),
        ("name", "STUDBUD_SPACE_NAME"),
        ("building", "STUDBUD_SPACE_BUILDING"),
    ):
        if os.environ.get(env):
            config[key] = os.environ[env]
            overridden.append(env)
    # Printed after the overrides so it names where each post will really go.
    if overridden:
        source += " + " + ", ".join(overridden)
    print(f"config: {source} -> {config['url'] or 'no url'}")
    return config


CONFIG = load_config()

samples: list[tuple[float, float, float, float]] = []
last_post = 0.0


def on_sample(temperature: float, humidity: float, sound: float, light: float) -> None:
    values = (temperature, humidity, sound, light)
    if any(math.isnan(value) for value in values):
        print("skipping sample with a sensor that has not reported yet")
        return
    for value, (name, low, high) in zip(values, RANGES):
        if not low <= value <= high:
            # A wrong sensor type decodes into confident nonsense rather than
            # failing, and one bad sweep skews a room's score for a day.
            print(f"skipping sample: {name}={value} is outside {low}..{high}")
            return
    samples.append(values)
    del samples[:-MAX_SAMPLES]


def post(payload: dict) -> bool:
    if not CONFIG["url"]:
        print(
            "no url configured: put studbud.json next to the app"
            f" ({CONFIG_PATHS[1]}) with a \"url\" field"
        )
        return False
    headers = {}
    if CONFIG["token"]:
        headers["Authorization"] = f"Bearer {CONFIG['token']}"
    try:
        response = requests.post(CONFIG["url"], json=payload, headers=headers, timeout=5)
    except requests.RequestException as error:
        print(f"post failed: {error}")
        return False
    if response.status_code >= 400:
        print(f"post {response.status_code}: {response.text[:200]}")
        if response.status_code == 400 and "are required for new space" in response.text:
            print(
                f"  -> {CONFIG['spaceId']} does not exist on the server yet, and this"
                " node does not count seats. Have the robot dog post once, or add"
                ' "occupiedSeats" and "totalSeats" to studbud.json.'
            )
        return False
    print(f"post {response.status_code} {payload['spaceId']}")
    return True


def loop() -> None:
    global last_post

    now = time.monotonic()
    if now - last_post < POST_INTERVAL:
        time.sleep(1)
        return
    last_post = now

    if not samples:
        print("no samples yet - is the sketch running?")
        return

    batch = samples[:]
    count = len(batch)

    payload = {
        "spaceId": CONFIG["spaceId"],
        "name": CONFIG["name"],
        "building": CONFIG["building"],
        "temperature": round(sum(s[0] for s in batch) / count, 1),
        "humidity": round(sum(s[1] for s in batch) / count, 1),
        # Noise is judged by how loud the room gets, not by its quiet moments.
        "sound": round(max(s[2] for s in batch), 1),
        "light": round(sum(s[3] for s in batch) / count),
    }
    if CONFIG["totalSeats"] is not None and CONFIG["occupiedSeats"] is not None:
        payload["totalSeats"] = CONFIG["totalSeats"]
        payload["occupiedSeats"] = CONFIG["occupiedSeats"]

    # Only drop the samples the server actually took: a timeout should cost a
    # minute of latency, not a minute of data.
    if post(payload):
        del samples[:count]


Bridge.provide("sample", on_sample)
App.run(user_loop=loop)
