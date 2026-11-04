#!/usr/bin/env python3
"""Reads the emulator screenshots and reports what the screens show, so a run can be judged from its log."""
import sys
from PIL import Image
K=None
def load(n):
    return Image.open(f"shots/{n}.png").convert("RGB")
def px(im,x,y):
    global K
    W,H=im.size;k=min(W/397,H/801);ox,oy=(W-397*k)/2,(H-801*k)/2
    return im.getpixel((int(ox+x*k),int(oy+y*k)))
def near(c,t,tol=70):
    return sum(abs(a-b) for a,b in zip(c,t))<=tol
CY=(0x72,0xFC,0xE9);GR=(0x88,0xF9,0x4E);OR=(0xF2,0x71,0x00);PG=(0x1C,0xB0,0x00)
fails=[]
def check(name,ok,detail=""):
    print(("PASS " if ok else "FAIL ")+name+" "+str(detail))
    if not ok: fails.append(name)
focus=open("shots/focus.txt").read().splitlines()
outside=[l.split()[0] for l in focus if "com.tandemgps" not in l]
check("every shot stayed in the app",not outside,outside)
a=load("17_maplink_moving_60mph");b=load("18_maplink_moving_115mph");c=load("19_maplink_stopped")
e17=px(a,2,400);e18=px(b,2,400);e19=px(c,2,400)
check("border is RangeBar cyan at about 67 mph",near(e17,CY,110),e17)
check("border is RangeBar green at about 115 mph",near(e18,GR,110),e18)
check("border is gone when stopped",sum(e19)<sum(e17)*.7,e19)
p17=px(a,180,145);p18=px(b,180,145)
check("limit pill is orange over 65",near(p17,OR,90) and near(p18,OR,90),(p17,p18))
p19=px(c,175,165)
check("limit pill is green when stopped",near(p19,PG,90),p19)
for n in ("01_profile","02_manage_rides","04_manage_groups","05_group_page","07_create_group","08_trackmode_stationary","09_create_lss","11_prompt1","13_prompt2","14_file_share","15_shared_ride","16_maplink_stationary"):
    print("colors",n,load(n).resize((1,1)).getpixel((0,0)))
if len(set(load(n).resize((8,16)).tobytes() for n in ("02_manage_rides","04_manage_groups","09_create_lss","13_prompt2","15_shared_ride")))<5: fails.append("screens not distinct");print("FAIL screens are not all different")
else: print("PASS sampled screens are all different")
print("RESULT",("FAILED: "+", ".join(fails)) if fails else "ALL CHECKS PASSED")
sys.exit(1 if fails else 0)
