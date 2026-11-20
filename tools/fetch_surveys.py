#!/usr/bin/env python3
"""Keep a copy of the survey images with the site.

Above 5 THz, Static shows real all-sky surveys served by the CDS archive in Strasbourg. Without
this script, every visitor's browser fetches them from CDS. With it, the site serves its own
copies: faster, works offline, and kinder to a free scientific service if your link takes off.

    python3 tools/fetch_surveys.py

Needs only Python 3 (no packages). It downloads one low-resolution "Allsky" image per survey
(about 0.2-1 MB each) into data/surveys/ and writes data/surveys/surveys.json, which the site
reads on start. Run it again any time; existing files are kept unless you pass --force.

The night-sky photo (Axel Mellinger's panorama) is copyrighted, all rights reserved, so it is
never copied: the site always shows it live from CDS, the way other sky viewers do.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "surveys")
CDS = "https://alasky.cds.unistra.fr"
CDS_BIS = "https://alaskybis.cds.unistra.fr"
IRSA = "https://irsa.ipac.caltech.edu/data/hips/CDS"  # NASA/IPAC's mirror of CDS's surveys
ESA = "https://skies.esac.esa.int"  # ESA's sky archive

# Keep in step with js/surveys.js: key, copies to try in order (CDS registry's mirrors), file type, credit.
SURVEYS = [
    ("iras", [f"{CDS}/IRISColor", f"{IRSA}/IRIS/color", f"{CDS_BIS}/IRISColor"], "jpg",
     "IRIS (IRAS reprocessed): Miville-Deschenes & Lagache 2005, NASA/IPAC; HEALPix by CDS"),
    ("wise", [f"{CDS}/AllWISE/RGB-W4-W2-W1", f"{IRSA}/AllWISE/RGB-W4-W2-W1", f"{CDS_BIS}/AllWISE/RGB-W4-W2-W1"], "jpg",
     "AllWISE: NASA/JPL-Caltech/UCLA; HEALPix and colors by CDS"),
    ("twomass", [f"{CDS}/2MASS/Color", f"{IRSA}/2MASS/Color", f"{CDS_BIS}/2MASS/Color"], "jpg",
     "2MASS: UMass and IPAC/Caltech, NASA, NSF; HEALPix and colors by CDS"),
    ("halpha", [f"{CDS}/FinkbeinerHalpha", f"{CDS_BIS}/FinkbeinerHalpha"], "jpg",
     "H-alpha composite: D. Finkbeiner 2003 (WHAM, VTSS, SHASSA); HEALPix by CDS"),
    ("galex", [f"{CDS}/GALEX/GALEXGR6_7_NUV", f"{CDS_BIS}/GALEX/GALEXGR6_7_NUV"], "png",
     "GALEX GR6/7 NUV: NASA/Caltech; HEALPix by CDS"),
    ("rosat", [f"{CDS}/RASS", f"{CDS_BIS}/RASS"], "jpg",
     "ROSAT All-Sky Survey: distributed by MPE; HEALPix by CDS"),
    ("integral", [f"{CDS}/ESAC/ESAVO_P_INTEGRAL_color", f"{ESA}/Integral/color", f"{CDS_BIS}/ESAC/ESAVO_P_INTEGRAL_color"], "jpg",
     "INTEGRAL: ESA (ESAC); served by CDS"),
    ("fermi", [f"{CDS}/Fermi/Color", f"{ESA}/FermiColor", f"{CDS_BIS}/Fermi/Color"], "jpg",
     "Fermi LAT: NASA/DOE/Fermi LAT Collaboration; HEALPix and colors by CDS"),
]


def fetch(url, timeout=25):
    """One try per copy: if a server is down, move on to the next copy instead of waiting."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Static sky radio (fetch_surveys.py)"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read()
    except urllib.error.HTTPError:
        raise  # a real answer from the server
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        # Python from python.org on macOS often ships without root certificates; curl has them
        if "CERTIFICATE" in str(e).upper() and shutil.which("curl"):
            out = subprocess.run(["curl", "-fsSL", "--max-time", "90", url], capture_output=True)
            if out.returncode == 0:
                return out.stdout
        raise


def looks_like(data, ext):
    if ext == "jpg":
        return data[:3] == b"\xff\xd8\xff"
    return data[:8] == b"\x89PNG\r\n\x1a\n"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="download again even if a file exists")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, "surveys.json")
    files, credits = {}, {}
    ok = 0
    for key, paths, ext, credit in SURVEYS:
        name = f"{key}.{ext}"
        dest = os.path.join(OUT, name)
        if os.path.exists(dest) and not args.force:
            print(f"  {key:9s} already here")
            files[key], credits[key] = name, credit
            ok += 1
            continue
        got = None
        for base in paths:
            url = f"{base}/Norder3/Allsky.{ext}"
            try:
                data = fetch(url)
                if not looks_like(data, ext):
                    raise ValueError("not an image")
                got = data
                break
            except Exception as e:  # try the next copy
                print(f"  {key:9s} {base.split('//')[1].split('/')[0]}: {e}")
        if got is None:
            print(f"  {key:9s} FAILED: no copy answered, so the site will try CDS live instead")
            continue
        with open(dest, "wb") as f:
            f.write(got)
        files[key], credits[key] = name, credit
        ok += 1
        print(f"  {key:9s} {len(got) / 1e6:.2f} MB")

    with open(manifest_path, "w") as f:
        json.dump({"version": 1, "source": "CDS HiPS, Norder3/Allsky", "files": files, "credits": credits}, f, indent=1)
    print(f"\n{ok} of {len(SURVEYS)} surveys saved in data/surveys/. Reload the site to use them.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
