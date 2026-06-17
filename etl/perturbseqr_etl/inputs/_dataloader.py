#!/usr/bin/env python3

import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

try:
    from tqdm import tqdm as _tqdm
except ImportError:        
    _tqdm = None


def _stream(url: str, dest: Path) -> None:
    """Stream `url` into `dest` via urllib, with a tqdm progress bar when tqdm is installed."""
    with urllib.request.urlopen(url, timeout=120) as resp:
        total = int(resp.headers.get("Content-Length") or 0) or None
        bar = _tqdm(total=total, unit="B", unit_scale=True, unit_divisor=1024,
                    desc=dest.name, leave=False) if _tqdm else None
        with open(dest, "wb") as f:
            while (chunk := resp.read(1 << 16)):
                f.write(chunk)
                if bar:
                    bar.update(len(chunk))
        if bar:
            bar.close()


def download_to(url: str, dest: Path, *, no_cache: bool = False) -> Path:
    """Download `url` to `dest` (cache-guarded; tqdm progress when tqdm is installed). Hosts that
    serve an incomplete cert chain Python can't verify (e.g. repo-hub.broadinstitute.org) fall back
    to curl (system trust store + AIA). Raises on HTTP/network errors."""
    dest = Path(dest)
    if dest.exists() and not no_cache:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        _stream(url, dest)
    except urllib.error.URLError as e:
        if not isinstance(getattr(e, "reason", None), ssl.SSLError):
            raise   # genuine network/HTTP error — don't mask it behind curl
        subprocess.run(["curl", "-fSL", "--progress-bar" if sys.stderr.isatty() else "-s",
                        "-o", str(dest), url], check=True)
    return dest
