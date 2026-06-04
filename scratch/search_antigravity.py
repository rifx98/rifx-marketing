import os
import time

antigravity_dir = r"C:\Users\x\.gemini\antigravity-ide"
for root, dirs, files in os.walk(antigravity_dir):
    for f in files:
        if 'panel-client' in f.lower() or 'panel_client' in f.lower():
            fp = os.path.join(root, f)
            stat = os.stat(fp)
            mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))
            print(f"{fp} | Size: {stat.st_size} bytes | Modified: {mtime}")
