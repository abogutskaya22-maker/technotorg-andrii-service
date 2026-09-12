from pathlib import Path

p = Path('index.html')
s = p.read_text()
tag = '<script src="/compat.js?v=2" defer></script>'
if tag not in s:
    if '</body>' not in s:
        raise SystemExit('body close tag not found')
    s = s.replace('</body>', tag + '</body>', 1)
p.write_text(s)
