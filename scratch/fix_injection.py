import os

file_path = 'app/panel/panel-client.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

out = []
skip = 0
for line in lines:
    if skip > 0:
        skip -= 1
        continue
    if "{activeTab === 'pricing' && (" in line:
        skip = 2
        continue
    out.append(line)

# Now, before writing, inject the PricingTab at the very end right before </main>
# We can loop through 'out' backwards to find </main>
for i in range(len(out)-1, -1, -1):
    if "</main>" in out[i]:
        out.insert(i, "        {activeTab === 'pricing' && (<PricingTab language={language} tenantData={tenantData} />)}\n")
        break

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(out)

print("Done removing bad injection and re-injecting at the end.")
