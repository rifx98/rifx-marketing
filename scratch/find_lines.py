import os

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

queries = ["botKnowledgeFiles", "isTestingAi", "showPlanConfirm", "fetchKBFiles"]

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for query in queries:
    print(f"=== Matches for '{query}' ===")
    for idx, line in enumerate(lines):
        if query in line:
            print(f"{idx+1}: {line.strip()}")
