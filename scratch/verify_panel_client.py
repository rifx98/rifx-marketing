import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

search_terms = ["facebook_access_token", "Marketing de Facebook", "facebook-signin-button"]

results = []
try:
    with open(file_path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, 1):
            for term in search_terms:
                if term in line:
                    results.append((idx, term, line.strip()))
                    break
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

print(f"Found {len(results)} matches.")
for idx, term, line in results:
    print(f"Line {idx} ({term}): {line[:120]}")
