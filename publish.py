"""Copy the latest maps in and push them live.

`git push` sends to two GitHub repos at once: metasolutions.me (blocked on Uni Melb
wifi as a new domain) and rogueacademia.net (works on campus).

The platform games map is one page plus the files it loads beside it: its fonts, the
outline-text drawer, the money map and its pictures, the stores card, and hand control.
It is at /roblox/ (where its QR code points) and /platform-games/; the money map also
stands alone at money.html beside it.

Run:  python publish.py
"""
import shutil
import subprocess
from pathlib import Path

SITE = Path(__file__).parent
MAPS = Path(r"C:\Users\parke\Desktop\2026\SCHOOL SEMESTER 2\Roblox infomap")
GAMES = SITE / "platform-games"

# The map's QR code opens /roblox/, so the platform games map lives there; /platform-games/ is the same map.
# The earlier Roblox maps stay at /roblox/v2/ and /roblox/v1/.
COPIES = {
    MAPS / "roblox-infomap-v2.html": SITE / "roblox" / "v2" / "index.html",
    MAPS / "roblox-infomap.html": SITE / "roblox" / "v1" / "index.html",
}
for home in (SITE / "roblox", GAMES):
    COPIES[MAPS / "platform-games-map.html"] = None
    COPIES[(MAPS / "platform-games-map.html", home)] = home / "index.html"
    COPIES[(MAPS / "roblox-money-flow.html", home)] = home / "money.html"
    for name in ["map-fonts.js", "path-text.js", "roblox-money-map.js", "replace-card.js", "hand-control.js"]:
        COPIES[(MAPS / name, home)] = home / name
    for pic in (MAPS / "money-images").glob("*.jpg"):
        COPIES[(pic, home)] = home / "money-images" / pic.name
COPIES = {(k[0] if isinstance(k, tuple) else k, v) for k, v in COPIES.items() if v is not None}

for src, dest in COPIES:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)

subprocess.run(["git", "add", "-A"], cwd=SITE, check=True)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=SITE).returncode == 0:
    print("Nothing changed.")
else:
    subprocess.run(["git", "commit", "-m", "Update maps"], cwd=SITE, check=True)
    subprocess.run(["git", "push"], cwd=SITE, check=True)
    print("Pushed. Live at metasolutions.me and rogueacademia.net in about a minute.")
