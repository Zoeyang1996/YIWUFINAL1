"""Read-only inspection of the editable noon scene."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
source = (ROOT/'scripts/inspect_night_source.py').read_text(encoding='utf8')
source = source.replace('首页/夜/二级场景/03_夜市_场景精修.blend', '首页/午/二级场景/02_午市_场景精修.blend')
source = source.replace('night-source-inspection.json', 'noon-source-inspection.json')
exec(compile(source, __file__, 'exec'))
