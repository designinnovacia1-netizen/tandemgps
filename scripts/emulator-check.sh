#!/usr/bin/env bash
# Walks every reachable screen, feeds a moving GPS track, saves screenshots plus logs.
set -u
mkdir -p shots
adb install -g app-release.apk
adb logcat -c
# Launch crashes can be intermittent, so cold start the app repeatedly and count them.
LAUNCH_FAILS=0
for i in $(seq 1 8); do
  adb shell am force-stop com.tandemgps; sleep 1
  adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 7
  adb shell pidof com.tandemgps >/dev/null || LAUNCH_FAILS=$((LAUNCH_FAILS+1))
done
CRASHES=$(adb logcat -d -b crash | grep -c "Fatal signal\|FATAL EXCEPTION")
echo "cold starts: 8, not running afterward: $LAUNCH_FAILS, crash entries: $CRASHES" | tee shots/launches.txt
adb logcat -d -b crash > shots/crash_launches.txt
adb shell pidof com.tandemgps >/dev/null || { adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 7; }
W=$(adb shell wm size | awk '{print $3}' | cut -dx -f1 | tr -d '\r'); H=$(adb shell wm size | awk '{print $3}' | cut -dx -f2 | tr -d '\r')
K=$(awk "BEGIN{a=$W/397;b=$H/801;print (a<b)?a:b}"); OX=$(awk "BEGIN{print ($W-397*$K)/2}"); OY=$(awk "BEGIN{print ($H-801*$K)/2}")
# Login and Join art is 414x916, the other plates 397x801. U picks which grid tap() uses.
KL=$(awk "BEGIN{a=$W/414;b=$H/916;print (a<b)?a:b}"); OXL=$(awk "BEGIN{print ($W-414*$KL)/2}"); OYL=$(awk "BEGIN{print ($H-916*$KL)/2}")
U=P
tap(){ if [ "$U" = L ]; then local k=$KL ox=$OXL oy=$OYL; else local k=$K ox=$OX oy=$OY; fi
  adb shell input tap "$(awk "BEGIN{printf \"%d\",$ox+$1*$k}")" "$(awk "BEGIN{printf \"%d\",$oy+$2*$k}")"; sleep "${3:-2}"; }
shot(){ adb exec-out screencap -p > "shots/$1.png"; echo "$1 $(adb shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r')" >> shots/focus.txt; }
backkey(){ adb shell input keyevent 4; sleep 2; if ! adb shell dumpsys window | grep -m1 mCurrentFocus | grep -q com.tandemgps; then echo "left the app at back key" >> shots/focus.txt; adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 5; fi; }
# Road-following drives in Sheridan, WY (Coffeen Ave onto I-90), one fix per second.
python3 scripts/route.py walk > shots/route_walk.txt 2> shots/route_log.txt
python3 scripts/route.py demo > shots/route_demo.txt 2>> shots/route_log.txt
cat shots/route_log.txt
read LON LAT < shots/route_walk.txt
fix(){ adb emu geo fix "$LON" "$LAT" </dev/null >/dev/null; }
# drive FILE FIRST LAST: feed lines FIRST..LAST of a route file, one per second.
drive(){ while read -r LON LAT; do fix; sleep 1; done < <(sed -n "$2,$3p" "$1"); }
# Press a button by its accessibility label, falling back to screen coordinates if the UI will not dump.
press(){ local label="$1" x="$2" y="$3" wait="${4:-2}"; local c
  for t in 1 2 3; do
    c=$(timeout 15 adb shell "uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml" 2>/dev/null | tr -d '\r' | python3 scripts/find_label.py "$label")
    [ -n "$c" ] && break; sleep 1
  done
  [ -z "$c" ] && adb shell cat /sdcard/u.xml > "shots/dump_$(echo "$label" | tr -c 'A-Za-z0-9' _).xml" 2>/dev/null
  if [ -n "$c" ]; then echo "press $label by label at $c" >> shots/walk.txt; adb shell input tap $c; sleep "$wait"
  else echo "press $label by coordinates $x,$y (label not found)" >> shots/walk.txt; tap "$x" "$y" "$wait"; fi; }
fix; sleep 8
typein(){ adb shell input text "$1"; sleep 1; }
hidekb(){ if adb shell dumpsys input_method | grep -q "mInputShown=true"; then adb shell input keyevent 4; sleep 1; fi; }
# Fresh install is logged out, so the app opens on Login. Register, log out, log back in.
U=L
shot 00a_login
press Register 208 720; shot 00b_join
press "User name" 208 276; typein Razer; hidekb
press Email 208 331; typein razer@tandemgps.com; hidekb
press Country 208 389; sleep 1; shot 00c_country_list
# The country list scrolls; swipe until United States is on screen.
for i in $(seq 1 25); do
  c=$(timeout 15 adb shell "uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml" 2>/dev/null | tr -d '\r' | python3 scripts/find_label.py "Canada")
  [ -n "$c" ] && break
  adb shell input swipe $((W/2)) $((H*70/100)) $((W/2)) $((H*30/100)) 300; sleep 1
done
echo "country found after $i tries" >> shots/walk.txt
press "Canada" 208 500
press City 208 445; typein Greeley; hidekb
press Password 208 500; typein ride2026; hidekb
press "Confirm password" 208 560; typein ride2026; hidekb
press "Agree to terms" 96 620; shot 00d_join_filled
press Join 206 720 4
shot 00e_after_join
U=P
shot 01_profile
press Rides 200 500; shot 02_manage_rides
press SportRide 170 322; shot 03_manage_rides_selected
press SportRide 170 322; backkey
press Groups 200 590; shot 04_manage_groups
press Visit 200 730; shot 05_group_page
press "BILLY BOB" 200 240; shot 06_group_member_selected
press "BILLY BOB" 200 240
press Add 190 190; shot 07_create_group
backkey; backkey; backkey
press "Lets go" 200 707 4; shot 08_trackmode_stationary
press "Create LSS" 40 730; shot 09_create_lss
tap 180 280; shot 10_create_lss_color
tap 279 546; tap 144 500; tap 337 500; tap 197 470; shot 10b_create_lss_band
backkey
press Share 327 60; shot 11_prompt1
press "Group two" 200 300; shot 12_prompt1_selected
tap 5 620 3; shot 13_prompt2
press "Go back" 60 80 2; shot 14_file_share
press Share 200 735 7; shot 15_shared_ride
press "Lets go" 195 735 4; shot 16_maplink_stationary
drive shots/route_walk.txt 2 13; shot 17_maplink_moving_60mph
drive shots/route_walk.txt 14 21; shot 18_maplink_moving_115mph
sleep 8; shot 19_maplink_stopped
# Demo video: create a speedo in Create LSS, then ride it on the connected TrackMode map.
adb shell am force-stop com.tandemgps; sleep 1
read LON LAT < shots/route_demo.txt; fix; sleep 2
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 8
press Profile 200 70 3
press Rides 200 500 3
press "Lets go" 200 735 4
press "Create LSS" 40 730 3
adb shell rm -f /sdcard/demo.mp4
adb shell screenrecord --bit-rate 8000000 --time-limit 180 /sdcard/demo.mp4 &
REC=$!
sleep 3
digit(){ case $1 in 0) tap 337 501 1;; 1) tap 62 500 1;; 2) tap 80 531 1;; 3) tap 105 554 1;; 4) tap 136 571 1;; 5) tap 176 578 1;; 6) tap 213 578 1;; 7) tap 253 572 1;; 8) tap 288 554 1;; 9) tap 318 532 1;; esac; }
band(){ tap "$1" "$2" 2; for d in $(echo "$3" | grep -o .); do digit "$d"; done; sleep 1; press Confirm 197 470 2; }
band 254 312 30; band 194 300 60; band 290 276 90; band 278 360 200
press Filename 197 628 2; typein "Demo%sSpeedo"; hidekb; sleep 2
press "Lets go" 200 725 5
# Coffeen Ave at city speed, up the on-ramp onto I-90, up to 120 mph, back down, stop
read LON LAT < shots/route_demo.txt; fix; sleep 2
drive shots/route_demo.txt 2 999
for i in $(seq 1 10); do fix; sleep 1; done
sleep 2
# Stop the recorder on the phone itself so it finishes writing the file, then wait for it to exit.
adb shell pkill -INT screenrecord; wait $REC 2>/dev/null; sleep 3
adb pull /sdcard/demo.mp4 shots/speedometer_demo.mp4 || echo "no video" >> shots/walk.txt
python3 - <<'PY' >> shots/walk.txt
d=open('shots/speedometer_demo.mp4','rb').read()
print('video has moov index:', b'moov' in d, 'bytes:', len(d))
PY
# Logout and log back in last, so a problem here cannot spoil the walk or the video.
adb shell am force-stop com.tandemgps; sleep 1
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 8
press Profile 200 70 3
press Logout 74 65 3; shot 20_logged_out
press Email 208 380; typein razer@tandemgps.com; hidekb
press Password 208 450; typein ride2026; hidekb
press "Log in" 207 655 4
U=P
shot 21_logged_back_in
for f in shots/dump_*.xml; do [ -f "$f" ] && { echo "$f: $(head -c 600 "$f")" >> shots/walk.txt; }; done
adb logcat -d -b crash > shots/crash.txt
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime" | grep -v "Mbgl-HttpRequest\|permanent error" | tail -400 > shots/js.txt
adb logcat -d | grep "ReactNativeJS" | grep "TG " | grep -v "TG fix" | sed 's/.*ReactNativeJS: //' | awk '!seen[$0]++' > shots/tg.txt
adb shell pidof com.tandemgps > shots/alive.txt || echo DEAD > shots/alive.txt
test -s shots/alive.txt && ! grep -q DEAD shots/alive.txt && [ "$LAUNCH_FAILS" -eq 0 ] && [ "$CRASHES" -eq 0 ]
