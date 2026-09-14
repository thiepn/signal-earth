from pathlib import Path
import subprocess
import textwrap

source = subprocess.check_output(
    ['git', 'show', 'HEAD^:.github/workflows/phase16-implement.yml'],
    text=True,
)
start_marker = "          python <<'PY'\n"
end_marker = "\n          PY\n\n      - name: Commit Phase 16"
start = source.index(start_marker) + len(start_marker)
end = source.index(end_marker, start)
script = textwrap.dedent(source[start:end])
Path('/tmp/phase16.py').write_text(script, encoding='utf-8')
subprocess.run(['python', '/tmp/phase16.py'], check=True)
