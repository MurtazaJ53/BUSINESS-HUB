import os
import re

HOOKS = {
    'inventory': "useLiveQuery<InventoryItem>('SELECT * FROM inventory WHERE tombstone = 0 ORDER BY name ASC', [], ['inventory'])",
    'inventoryPrivate': "useLiveQuery<any>('SELECT * FROM inventory_private WHERE tombstone = 0', [], ['inventory_private'])",
    'sales': "useLiveQuery<Sale>('SELECT * FROM sales WHERE tombstone = 0 ORDER BY createdAt DESC', [], ['sales'])",
    'customers': "useLiveQuery<Customer>('SELECT * FROM customers WHERE tombstone = 0 ORDER BY name ASC', [], ['customers'])",
    'expenses': "useLiveQuery<Expense>('SELECT * FROM expenses WHERE tombstone = 0 ORDER BY date DESC', [], ['expenses'])",
    'staff': "useLiveQuery<Staff>('SELECT * FROM staff WHERE tombstone = 0 ORDER BY name ASC', [], ['staff'])",
    'staffPrivate': "useLiveQuery<any>('SELECT * FROM staff_private WHERE tombstone = 0', [], ['staff_private'])",
    'attendance': "useLiveQuery<Attendance>('SELECT * FROM attendance WHERE tombstone = 0', [], ['attendance'])",
}

PAGES_DIR = 'src/pages'

for file in os.listdir(PAGES_DIR):
    if not file.endswith('.tsx'): continue
    path = os.path.join(PAGES_DIR, file)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the destructuring block for useBusinessStore
    block_match = re.search(r'const\s+\{\s*([^}]+)\s*\}\s*=\s*useBusinessStore\(\);', content, re.MULTILINE)
    
    # Alternatively find direct access like const inventory = useBusinessStore(s => s.inventory);
    content = re.sub(r'const\s+(\w+)\s*=\s*useBusinessStore\(\w*\s*=>\s*\w*\.\1\);', lambda m: f"const {m.group(1)} = " + HOOKS.get(m.group(1), m.group(0)) + ";", content)

    if block_match:
        fields = block_match.group(1).split(',')
        keep_fields = []
        injected_queries = []
        
        for field in fields:
            field = field.strip()
            if not field: continue
            
            base_field = field.split(':')[0].strip() if ':' in field else field
            
            if base_field in HOOKS:
                injected_queries.append(f"const {base_field} = {HOOKS[base_field]};")
            else:
                keep_fields.append(field)
                
        new_block = f"const {{ {', '.join(keep_fields)} }} = useBusinessStore();\n  " + "\n  ".join(injected_queries)
        content = content.replace(block_match.group(0), new_block)
        
        if injected_queries and 'useLiveQuery' not in content:
            content = content.replace("import { useBusinessStore }", "import { useLiveQuery } from '@/db/hooks';\nimport { useBusinessStore }")
            
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
