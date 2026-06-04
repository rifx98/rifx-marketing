import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

search_terms = ["adminTab === 'templates'"]

results = []
try:
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        for idx, line in enumerate(lines, 1):
            for term in search_terms:
                if term in line:
                    results.append((idx, line.strip()))
                    break
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

print(f"Found {len(results)} matches.")
for idx, line in results:
    print(f"Line {idx}: {line}")
    # Print 15 lines before
    start = max(0, idx - 15)
    for i in range(start, idx):
        print(f"  {i+1}: {lines[i]}", end="")
