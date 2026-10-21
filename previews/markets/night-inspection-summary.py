import json, sys
sys.stdout.reconfigure(encoding='utf-8')
data = json.load(open('previews/markets/night-source-inspection.json', encoding='utf8'))
print('TOTALS', data['totals'])
print('WORLD', data['world'])
print('--- COLLECTIONS', len(data['collections']))
for name, info in data['collections'].items():
    print(f"{name} | n={info['count']} v={info['vertices']} min={info['min']} max={info['max']}")
    print('   mats:', info['materials'])
    print('   names:', info['names'])
print('--- MATERIALS')
for m in data['materials']:
    print(m)
print('--- EMPTIES/LIGHTS')
for o in data['objects']:
    if o['type'] in ('EMPTY', 'LIGHT'):
        print(o)
unknown = [o for o in data['objects'] if o['type'] == 'MESH' and (not o['collections'] or o['name'].startswith('Environment_'))]
print('--- LOOSE/ENV MESHES', len(unknown))
for o in unknown[:80]:
    print(o['name'], o['min'], o['max'], o['materials'], o['surface'], o['occluder'], o['water'])
