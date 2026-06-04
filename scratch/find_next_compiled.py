import os

next_dir = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\.next"
if not os.path.exists(next_dir):
    print(".next folder does not exist.")
else:
    results = []
    for root, dirs, files in os.walk(next_dir):
        for f in files:
            if f.endswith('.js'):
                fp = os.path.join(root, f)
                try:
                    size = os.path.getsize(fp)
                    if size > 100000: # larger than 100KB
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as file_obj:
                            content = file_obj.read()
                            if 'PanelClient' in content and 'Campaigns' in content:
                                results.append((fp, size))
                except:
                    pass
    for r in results:
        print(f"Found: {r[0]} | Size: {r[1]} bytes")
