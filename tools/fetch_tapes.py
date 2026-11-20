#!/usr/bin/env python3
"""Keep a copy of the tapes' recordings with the site.

The tapes play real recordings from NASA's "Sounds from Beyond" page. Without this script, the
player streams each one straight from nasa.gov. With it, the site serves its own copies: they
start faster, the level meter on the player can follow the sound, and nothing depends on NASA's
links staying put.

    python3 tools/fetch_tapes.py

Needs only Python 3. If ffmpeg is installed, each recording is also turned into an MP3, which
makes the whole set about 30 MB instead of a few hundred. Without ffmpeg, the WAV files are kept
as they are, except any too big to host (see --max-mb); those keep streaming from NASA.

    macOS:   brew install ffmpeg
    Windows: winget install ffmpeg

The list of recordings comes from js/tapes.js, so the two can't drift apart. Run the script
again any time; existing copies are kept unless you pass --force.
"""

import argparse
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "tapes")
TAPES_JS = os.path.join(ROOT, "js", "tapes.js")
UA = "Static sky radio (fetch_tapes.py)"


def recordings():
    """(key, url) for every side of every tape, read from js/tapes.js."""
    with open(TAPES_JS, encoding="utf-8") as f:
        src = f.read()
    pairs = re.findall(r'file:\s*"([a-z0-9]+)",\s*url:\s*"(https://[^"]+)"', src)
    if not pairs:
        sys.exit("Couldn't find any recordings in js/tapes.js.")
    return pairs


def download(url, dest, tries=3):
    """Stream a URL to a file, with a dot every few megabytes."""
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
                got, mark = 0, 0
                while True:
                    chunk = r.read(1 << 16)
                    if not chunk:
                        break
                    f.write(chunk)
                    got += len(chunk)
                    if got - mark > 4e6:
                        mark = got
                        print(".", end="", flush=True)
            return
        except urllib.error.HTTPError:
            raise  # a real answer from the server: retrying won't help
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = e
            # Python from python.org on macOS often ships without root certificates; curl has them
            if "CERTIFICATE" in str(e).upper() and shutil.which("curl"):
                done = subprocess.run(["curl", "-fsSL", "--max-time", "600", "-A", UA, "-o", dest, url])
                if done.returncode == 0:
                    return
            time.sleep(2 * (i + 1))
    raise last


def wav_info(path):
    """(seconds, sample rate) from a WAV file's header, or (None, None) if it isn't one."""
    with open(path, "rb") as f:
        head = f.read(12)
        if len(head) < 12 or head[:4] != b"RIFF" or head[8:12] != b"WAVE":
            return None, None
        rate = byte_rate = None
        while True:
            h = f.read(8)
            if len(h) < 8:
                return None, rate
            cid, size = h[:4], struct.unpack("<I", h[4:])[0]
            if cid == b"fmt ":
                fmt = f.read(size)
                _, _, rate, byte_rate = struct.unpack("<HHII", fmt[:12])
                if size % 2:
                    f.read(1)
            elif cid == b"data":
                if not byte_rate:
                    return None, rate
                remaining = os.path.getsize(path) - f.tell()
                if size == 0 or size == 0xFFFFFFFF or size > remaining:
                    size = remaining  # some encoders leave the size blank
                return size / byte_rate, rate
            else:
                f.seek(size + (size % 2), 1)


def is_mp3(path):
    with open(path, "rb") as f:
        h = f.read(3)
    return h == b"ID3" or (len(h) >= 2 and h[0] == 0xFF and (h[1] & 0xE0) == 0xE0)


def probe_seconds(path):
    if not shutil.which("ffprobe"):
        return None
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True)
    try:
        return round(float(out.stdout.strip()), 2)
    except ValueError:
        return None


def to_mp3(src, dest, rate):
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", src, "-codec:a", "libmp3lame", "-q:a", "2"]
    if rate and rate > 48000:
        cmd += ["-ar", "48000"]  # the highest rate MP3 allows
    cmd.append(dest)
    return subprocess.run(cmd).returncode == 0 and os.path.exists(dest) and os.path.getsize(dest) > 1000


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="download again even if a copy exists")
    ap.add_argument("--wav", action="store_true", help="keep the original WAV files even if ffmpeg is installed")
    ap.add_argument("--max-mb", type=float, default=50,
                    help="without ffmpeg, skip WAV files bigger than this (default 50; GitHub refuses files over 100 MB)")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, "tapes.json")
    old = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, encoding="utf-8") as f:
                old = json.load(f)
        except ValueError:
            old = {}
    files, durations = {}, {}
    use_ffmpeg = bool(shutil.which("ffmpeg")) and not args.wav
    if use_ffmpeg:
        print("Converting to MP3 with ffmpeg.\n")
    elif args.wav:
        print("Keeping the original WAV files.\n")
    else:
        print("ffmpeg not found: keeping WAV files (install ffmpeg for files about ten times smaller).\n")

    todo = recordings()
    total = 0
    for key, url in todo:
        have = (old.get("files") or {}).get(key)
        if have and os.path.exists(os.path.join(OUT, have)) and not args.force:
            files[key] = have
            if (old.get("durations") or {}).get(key):
                durations[key] = old["durations"][key]
            size = os.path.getsize(os.path.join(OUT, have))
            total += size
            print(f"  {key}  already here ({size / 1e6:.1f} MB)")
            continue
        ext = os.path.splitext(url.split("?")[0])[1].lower() or ".wav"
        fd, tmp = tempfile.mkstemp(suffix=ext, dir=OUT)
        os.close(fd)
        try:
            print(f"  {key}  downloading", end="", flush=True)
            download(url, tmp)
            seconds, rate = wav_info(tmp)
            if seconds is None and not is_mp3(tmp):
                raise ValueError("that isn't a WAV or MP3 file")
            if seconds is None:
                seconds = probe_seconds(tmp)
            if is_mp3(tmp):
                name = f"{key}.mp3"
                os.replace(tmp, os.path.join(OUT, name))
            elif use_ffmpeg:
                name = f"{key}.mp3"
                if not to_mp3(tmp, os.path.join(OUT, name), rate):
                    raise RuntimeError("ffmpeg couldn't convert it")
            else:
                mb = os.path.getsize(tmp) / 1e6
                if mb > args.max_mb:
                    print(f"  {mb:.0f} MB: too big to host, so this side will stream from NASA")
                    continue
                name = f"{key}.wav"
                os.replace(tmp, os.path.join(OUT, name))
            size = os.path.getsize(os.path.join(OUT, name))
            total += size
            files[key] = name
            if seconds:
                durations[key] = round(seconds, 2)
            mins = f", {int(seconds // 60)}:{int(seconds % 60):02d}" if seconds else ""
            print(f"  {size / 1e6:.1f} MB{mins}")
        except Exception as e:
            print(f"\n  {key}  FAILED ({e}): this side will stream from NASA instead")
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "version": 1,
            "source": "https://www.nasa.gov/sounds-from-beyond/",
            "note": "Written by tools/fetch_tapes.py. Sides not listed here stream from NASA.",
            "files": files,
            "durations": durations,
        }, f, indent=1)
    print(f"\n{len(files)} of {len(todo)} recordings saved in data/tapes/ ({total / 1e6:.0f} MB). Reload the site to use them.")
    biggest = max((os.path.getsize(os.path.join(OUT, n)) for n in files.values()), default=0)
    if biggest > 95e6:
        print("One file is over 95 MB: GitHub won't accept it. Install ffmpeg and run this again with --force.")
    return 0 if files else 1


if __name__ == "__main__":
    sys.exit(main())
