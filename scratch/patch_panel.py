import re

file_path = 'app/panel/panel-client.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import PricingTab
if 'import PricingTab' not in content:
    content = content.replace("import ThemeSettings from './theme-settings';", "import ThemeSettings from './theme-settings';\nimport PricingTab from './PricingTab';")

# 2. Add to TABS_TO_MANAGE
if "{ key: 'pricing'" not in content:
    content = content.replace("{ key: 'appointments', label: 'Citas y Reservas' }", "{ key: 'appointments', label: 'Citas y Reservas' },\n  { key: 'pricing', label: 'Catálogo de Precios' }")

# 3. Add the component render
if '<PricingTab' not in content:
    # Let's find the closing of one of the tabs.
    # The appointments tab is rendered as `{activeTab === 'appointments' && ( ... )}`
    # Let's just look for `{activeTab === 'appointments' && (` and then append our block right before the final closing div.
    # Actually, the file structure might be:
    # </div>
    #   {activeTab === 'pricing' && <PricingTab ... />}
    # </main>
    # We can inject right before </main> or at the end of the <main className="..."> block.
    
    # We can also just use a simple regex to find the end of appointments block
    match = re.search(r"\{activeTab === 'appointments' && \([\s\S]*?\}\)[\s\n]*\}", content)
    if match:
        print('Found appointments block')
        insertion_point = match.end()
        inject = '''

        {activeTab === 'pricing' && (
          <PricingTab language={language} tenantData={tenantData} />
        )}
'''
        content = content[:insertion_point] + inject + content[insertion_point:]
    else:
        print('Could not find appointments block. Trying crm')
        match2 = re.search(r"\{activeTab === 'crm' && \([\s\S]*?\}\)[\s\n]*\}", content)
        if match2:
            print('Inserted after crm')
            insertion_point = match2.end()
            inject = '''

        {activeTab === 'pricing' && (
          <PricingTab language={language} tenantData={tenantData} />
        )}
'''
            content = content[:insertion_point] + inject + content[insertion_point:]
        else:
            print('Could not find injection point.')
            # Let's try injecting right before the final `</main>` or similar
            if '</main>' in content:
                print('Injecting before </main>')
                inject = '''
        {activeTab === 'pricing' && (
          <PricingTab language={language} tenantData={tenantData} />
        )}
'''
                content = content.replace('</main>', inject + '\n</main>')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done patching panel-client.tsx')
