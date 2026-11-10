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
tap(){ adb shell input tap "$(awk "BEGIN{printf \"%d\",$OX+$1*$K}")" "$(awk "BEGIN{printf \"%d\",$OY+$2*$K}")"; sleep "${3:-2}"; }
shot(){ adb exec-out screencap -p > "shots/$1.png"; echo "$1 $(adb shell dumpsys window | grep -m1 mCurrentFocus | tr -d '\r')" >> shots/focus.txt; }
backkey(){ adb shell input keyevent 4; sleep 2; if ! adb shell dumpsys window | grep -m1 mCurrentFocus | grep -q com.tandemgps; then echo "left the app at back key" >> shots/focus.txt; adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 5; fi; }
LAT=29.4241
fix(){ adb emu geo fix -98.4936 "$LAT" >/dev/null; }
drive(){ for i in $(seq 1 "$1"); do LAT=$(awk "BEGIN{printf \"%.6f\",$LAT+$2}"); fix; sleep 1; done; }
# Press a button by its accessibility label, falling back to screen coordinates if the UI will not dump.
press(){ local label="$1" x="$2" y="$3" wait="${4:-2}"; local c
  c=$(timeout 15 adb shell "uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml" 2>/dev/null | tr -d '\r' | python3 scripts/find_label.py "$label")
  if [ -n "$c" ]; then echo "press $label by label at $c" >> shots/walk.txt; adb shell input tap $c; sleep "$wait"
  else echo "press $label by coordinates $x,$y (label not found)" >> shots/walk.txt; tap "$x" "$y" "$wait"; fi; }
fix; sleep 8
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
drive 12 0.00027; shot 17_maplink_moving_60mph
drive 8 0.00047; shot 18_maplink_moving_115mph
sleep 8; shot 19_maplink_stopped
# Demo video: fresh start on TrackMode, then a ride through every RangeBar band and a stop.
adb shell am force-stop com.tandemgps; sleep 1
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 8
press "Lets go" 200 707 4
adb shell rm -f /sdcard/demo.mp4
adb shell screenrecord --bit-rate 8000000 --time-limit 120 /sdcard/demo.mp4 &
REC=$!
sleep 3
# degrees of latitude per second: 0.000040 is about 10 mph, 0.000404 about 100 mph
for step in "6 0.000040" "6 0.000121" "6 0.000202" "6 0.000283" "7 0.000404" "7 0.000606" "6 0.000404" "6 0.000202"; do drive $step; done
for i in $(seq 1 10); do fix; sleep 1; done
sleep 2
kill -INT $REC 2>/dev/null; sleep 4
adb pull /sdcard/demo.mp4 shots/speedometer_demo.mp4 || echo "no video" >> shots/walk.txt
adb logcat -d -b crash > shots/crash.txt
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime" | grep -v "Mbgl-HttpRequest\|permanent error" | tail -400 > shots/js.txt
grep "TG " shots/js.txt | sed 's/.*ReactNativeJS: //' | tail -80 > shots/tg.txt
adb shell pidof com.tandemgps > shots/alive.txt || echo DEAD > shots/alive.txt
test -s shots/alive.txt && ! grep -q DEAD shots/alive.txt && [ "$LAUNCH_FAILS" -eq 0 ] && [ "$CRASHES" -eq 0 ]
