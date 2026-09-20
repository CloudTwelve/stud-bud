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

CONFIG_PATH = Path(os.environ.get("STUDBUD_CONFIG", "/home/arduino/studbud.json"))
POST_INTERVAL = 60.0  # seconds
# ~10 minutes of samples: enough to ride out a short outage without the buffer
# growing forever while the server is down.
MAX_SAMPLES = 300


def load_config() -> dict:
    config = {
        "url": "http://192.168.1.42:3000/api/readings",
        "token": "",
        "spaceId": "hayden-reading-room",
        "name": "Hayden Reading Room",
        "building": "Building 14",
        # Leave seats out entirely when this node does not count people: the
        # dashboard keeps whatever the robot dog last reported for the room.
        "totalSeats": None,
        "occupiedSeats": None,
    }
    if CONFIG_PATH.is_file():
        config.update(json.loads(CONFIG_PATH.read_text()))
    for key, env in (
        ("url", "STUDBUD_URL"),
        ("token", "STUDBUD_INGEST_TOKEN"),
        ("spaceId", "STUDBUD_SPACE_ID"),
        ("name", "STUDBUD_SPACE_NAME"),
        ("building", "STUDBUD_SPACE_BUILDING"),
    ):
        if os.environ.get(env):
            config[key] = os.environ[env]
    return config


CONFIG = load_config()

samples: list[tuple[float, float, float, float]] = []
last_post = 0.0


def on_sample(temperature: float, humidity: float, sound: float, light: float) -> None:
    values = (temperature, humidity, sound, light)
    if any(math.isnan(value) for value in values):
        print("skipping sample with a sensor that has not reported yet")
        return
    samples.append(values)
    del samples[:-MAX_SAMPLES]


def post(payload: dict) -> bool:
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
