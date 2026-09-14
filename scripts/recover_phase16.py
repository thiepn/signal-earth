from pathlib import Path
import subprocess
import textwrap

start_marker = "          python <<'PY'\n"
end_marker = "\n          PY\n\n      - name: Commit Phase 16"
source = None
commits = subprocess.check_output(
    ['git', 'rev-list', '--max-count=20', 'HEAD'],
    text=True,
).splitlines()

for commit in commits[1:]:
    try:
        candidate = subprocess.check_output(
            ['git', 'show', f'{commit}:.github/workflows/phase16-implement.yml'],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        continue
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
