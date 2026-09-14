from pathlib import Path
import subprocess
import textwrap

start_marker = "          python <<'PY'\n"
end_marker = "\n          PY\n\n      - name: Commit Phase 16"
source = None
for ref in ('HEAD^', 'HEAD^^', 'HEAD^^^'):
    candidate = subprocess.check_output(
        ['git', 'show', f'{ref}:.github/workflows/phase16-implement.yml'],
        text=True,
    )
    if start_marker in candidate and end_marker in candidate:
        source = candidate
        break

if source is None:
    raise SystemExit('Unable to locate the staged Phase 16 patch in recent workflow history.')

start = source.index(start_marker) + len(start_marker)
end = source.index(end_marker, start)
script = textwrap.dedent(source[start:end])
Path('/tmp/phase16.py').write_text(script, encoding='utf-8')
subprocess.run(['python', '/tmp/phase16.py'], check=True)
