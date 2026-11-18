#!/usr/bin/env bash
# Puts Copperplate CC (SIL Open Font License) into the APK as CopperplateCC and CopperplateCC-Bold.
set -euo pipefail
D=android/app/src/main/assets/fonts; mkdir -p "$D"; rm -rf /tmp/cc; mkdir -p /tmp/cc
got=""
for u in "https://www.fontsquirrel.com/fonts/download/copperplate-cc" "https://cowboycollective.cc/zip/CopperplateCC.zip" "http://cowboycollective.cc/zip/CopperplateCC"; do
  if curl -fsSL --retry 3 -A "Mozilla/5.0" -o /tmp/cc/font.zip "$u" && unzip -o -q /tmp/cc/font.zip -d /tmp/cc/x; then got="$u"; break; fi
done
[ -n "$got" ] || { echo "FONT: could not download Copperplate CC"; exit 1; }
echo "FONT: downloaded from $got"; find /tmp/cc/x -type f | sed 's/^/FONT file: /'
pip install --quiet fonttools
python3 - "$D" <<'PY'
import sys,glob,os,shutil
from fontTools.ttLib import TTFont
D=sys.argv[1];fs=[f for f in glob.glob('/tmp/cc/x/**/*',recursive=True) if f.lower().endswith(('.ttf','.otf'))]
info=[]
for f in fs:
    t=TTFont(f);n=t['name'];full=(n.getDebugName(4) or '');sub=(n.getDebugName(2) or '');cm=t.getBestCmap()
    os2=t['OS/2'];info.append((f,full,sub,len(t.getGlyphOrder()),'a' in map(chr,cm) if cm else None,getattr(os2,'sCapHeight',None),t['head'].unitsPerEm))
    print('FONT found',os.path.basename(f),'|',full,'|',sub,'| glyphs',len(t.getGlyphOrder()),'| has lowercase a:',ord('a') in cm,'| capHeight',getattr(os2,'sCapHeight',None),'/',t['head'].unitsPerEm)
reg=[i for i in info if 'bold' not in (i[1]+i[2]).lower()];bold=[i for i in info if 'bold' in (i[1]+i[2]).lower()]
if not reg: sys.exit('FONT: no regular face found')
def put(i,name):
    ext=os.path.splitext(i[0])[1].lower();dst=f"{D}/{name}{ext}";shutil.copy(i[0],dst);print('FONT installed',dst,'from',os.path.basename(i[0]))
put(reg[0],'CopperplateCC');put((bold or reg)[0],'CopperplateCC-Bold')
for l in glob.glob('/tmp/cc/x/**/*',recursive=True):
    if 'ofl' in os.path.basename(l).lower() or 'license' in os.path.basename(l).lower(): shutil.copy(l,f"{D}/CopperplateCC-OFL.txt");print('FONT license copied',l);break
PY
ls -la "$D"
