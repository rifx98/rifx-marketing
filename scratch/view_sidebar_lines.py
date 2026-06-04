import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"c:\Users\x\OneDrive\Escritorio\rifx-marketing.github.io-main\app\panel\panel-client.tsx"

start = 4075
end = 4130

try:
    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
        for idx in range(start, min(end, len(lines))):
            print(f"{idx+1}: {lines[idx]}", end="")
except Exception as e:
    print(f"Error: {e}")
