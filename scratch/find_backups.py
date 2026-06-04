import os
import time

path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main"
for root, dirs, files in os.walk(path):
    for f in files:
        if 'panel-client' in f:
            fp = os.path.join(root, f)
            stat = os.stat(fp)
            mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime))
            print(f"{fp} | Size: {stat.st_size} bytes | Modified: {mtime}")
