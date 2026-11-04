#!/usr/bin/env bash
# Walks every reachable screen, feeds a moving GPS track, saves screenshots plus logs.
set -u
mkdir -p shots
adb install -g app-release.apk
adb logcat -c
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1
sleep 12
W=$(adb shell wm size | awk '{print $3}' | cut -dx -f1 | tr -d '\r'); H=$(adb shell wm size | awk '{print $3}' | cut -dx -f2 | tr -d '\r')
K=$(awk "BEGIN{a=$W/397;b=$H/801;print (a<b)?a:b}"); OX=$(awk "BEGIN{print ($W-397*$K)/2}"); OY=$(awk "BEGIN{print ($H-801*$K)/2}")
tap(){ adb shell input tap "$(awk "BEGIN{printf \"%d\",$OX+$1*$K}")" "$(awk "BEGIN{printf \"%d\",$OY+$2*$K}")"; sleep "${3:-2}"; }
shot(){ adb exec-out screencap -p > "shots/$1.png"; }
backkey(){ adb shell input keyevent 4; sleep 2; }
LAT=29.4241
fix(){ adb emu geo fix -98.4936 "$LAT" >/dev/null; }
drive(){ for i in $(seq 1 "$1"); do LAT=$(awk "BEGIN{printf \"%.6f\",$LAT+$2}"); fix; sleep 1; done; }
fix; sleep 2
shot 01_profile
tap 200 500; shot 02_manage_rides
tap 170 322; shot 03_manage_rides_selected
tap 170 322; backkey
tap 200 590; shot 04_manage_groups
tap 200 730; shot 05_group_page
tap 200 240; shot 06_group_member_selected
tap 200 240; backkey
tap 182 190; shot 07_create_group
backkey; backkey
tap 200 707 4; shot 08_trackmode_stationary
tap 40 730; shot 09_create_lss
tap 180 280; shot 10_create_lss_color
tap 144 500; backkey
tap 327 60; shot 11_prompt1
tap 200 260; shot 12_prompt1_selected
tap 5 620 3; shot 13_prompt2
tap 60 80 2; shot 14_file_share
tap 200 735 7; shot 15_shared_ride
tap 195 735 4; shot 16_maplink_stationary
drive 12 0.00027; shot 17_maplink_moving_60mph
drive 8 0.00047; shot 18_maplink_moving_115mph
sleep 7; shot 19_maplink_stopped
backkey
adb shell input keyevent 4; sleep 1
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1; sleep 3
shot 20_after_back
adb logcat -d -b crash > shots/crash.txt
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime" | grep -v "Mbgl-HttpRequest\|permanent error" | tail -120 > shots/js.txt
adb shell pidof com.tandemgps > shots/alive.txt || echo DEAD > shots/alive.txt
test -s shots/alive.txt && ! grep -q DEAD shots/alive.txt
