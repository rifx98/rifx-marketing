import os

search_term = ".rpc("
workspace_dir = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main"

matches = []
for root, dirs, files in os.walk(workspace_dir):
    if ".next" in root or "node_modules" in root or ".git" in root:
        continue
    for file in files:
        if file.endswith((".ts", ".tsx", ".js", ".jsx", ".sql")):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for idx, line in enumerate(f, 1):
                        if search_term in line:
                            matches.append((path, idx, line.strip()))
            except Exception:
                pass

print(f"Found {len(matches)} matches:")
for path, idx, line in matches:
    print(f"{os.path.basename(path)}:{idx}: {line[:120]}")
