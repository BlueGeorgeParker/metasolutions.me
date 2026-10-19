"""Copy the latest maps in and push them live.

`git push` sends to two GitHub repos at once: metasolutions.me (blocked on Uni Melb
wifi as a new domain) and rogueacademia.net (works on campus).

The platform games map (/platform-games/) is one page plus the files it loads beside
it: its fonts, the outline-text drawer, the money map and its pictures, the stores
card, and hand control. The money map also stands alone at /platform-games/money.html.

Run:  python publish.py
"""
import shutil
import subprocess
from pathlib import Path

SITE = Path(__file__).parent
MAPS = Path(r"C:\Users\parke\Desktop\2026\SCHOOL SEMESTER 2\Roblox infomap")
GAMES = SITE / "platform-games"

COPIES = {
    MAPS / "roblox-infomap-v2.html": SITE / "roblox" / "index.html",
    MAPS / "roblox-infomap.html": SITE / "roblox" / "v1" / "index.html",
    MAPS / "platform-games-map.html": GAMES / "index.html",
    MAPS / "roblox-money-flow.html": GAMES / "money.html",
}
for name in ["map-fonts.js", "path-text.js", "roblox-money-map.js", "replace-card.js", "hand-control.js"]:
    COPIES[MAPS / name] = GAMES / name
for pic in (MAPS / "money-images").glob("*.jpg"):
    COPIES[pic] = GAMES / "money-images" / pic.name

for src, dest in COPIES.items():
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)

subprocess.run(["git", "add", "-A"], cwd=SITE, check=True)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=SITE).returncode == 0:
    print("Nothing changed.")
else:
    subprocess.run(["git", "commit", "-m", "Update maps"], cwd=SITE, check=True)
    subprocess.run(["git", "push"], cwd=SITE, check=True)
    print("Pushed. Live at metasolutions.me and rogueacademia.net in about a minute.")
