import os
import glob
import time

history_path = os.path.expandvars(r"%APPDATA%\Code\User\History")
print("Searching in:", history_path)

if not os.path.exists(history_path):
    print("VS Code history path does not exist.")
else:
    # Find all files in subdirectories
    count = 0
    results = []
    for root, dirs, files in os.walk(history_path):
        for f in files:
            # VS Code history files are named randomly but have entries.json in the folder
            # to map them to real files, or we can just search for file content containing specific keywords
            fp = os.path.join(root, f)
            try:
                # only read files under 2MB
                size = os.path.getsize(fp)
                if size > 100000 and size < 1200000:
                    with open(fp, 'r', encoding='utf-8', errors='ignore') as file_obj:
                        head = file_obj.read(500)
                        if 'export default function PanelClient' in head or 'PanelClient(' in head:
                            mtime = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(os.path.getmtime(fp)))
                            results.append((fp, size, mtime))
            except Exception as e:
                pass
                
    # Sort results by mtime descending
    results.sort(key=lambda x: x[2], reverse=True)
    for r in results[:10]:
        print(f"Found: {r[0]} | Size: {r[1]} bytes | Modified: {r[2]}")
