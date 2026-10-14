"""Copy the latest Roblox infomap files in and push them live to rogueacademia.net.

Run:  python publish.py
"""
import shutil
import subprocess
from pathlib import Path

SITE = Path(__file__).parent
MAPS = Path(r"C:\Users\parke\Desktop\2026\SCHOOL SEMESTER 2\Roblox infomap")

COPIES = {
    MAPS / "roblox-infomap-v2.html": SITE / "roblox" / "index.html",
    MAPS / "roblox-infomap.html": SITE / "roblox" / "v1" / "index.html",
}

for src, dest in COPIES.items():
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)

subprocess.run(["git", "add", "-A"], cwd=SITE, check=True)
if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=SITE).returncode == 0:
    print("Nothing changed.")
else:
    subprocess.run(["git", "commit", "-m", "Update maps"], cwd=SITE, check=True)
    subprocess.run(["git", "push"], cwd=SITE, check=True)
    print("Pushed. Live at https://rogueacademia.net in about a minute.")
