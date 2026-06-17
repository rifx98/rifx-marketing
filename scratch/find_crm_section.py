import re

file_path = 'app/panel/panel-client.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

for idx, line in enumerate(lines):
    if "activeTab === 'crm'" in line or 'activeTab === "crm"' in line:
        print(f"Match activeTab === 'crm' on line {idx + 1}: {line.strip()}")
    elif "case 'crm'" in line:
        print(f"Match case 'crm' on line {idx + 1}: {line.strip()}")
    elif "activeTab === 'appointments'" in line:
        print(f"Match activeTab === 'appointments' on line {idx + 1}: {line.strip()}")

# Also search for where "conversationsData" is used
for idx, line in enumerate(lines):
    if "conversationsData" in line:
        # Print first 10 matches to avoid spamming
        print(f"Match conversationsData on line {idx + 1}: {line.strip()[:100]}")
