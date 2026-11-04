#!/usr/bin/env bash
# Installs the APK, feeds a moving GPS track and saves screenshots plus the crash log.
set -u
mkdir -p shots
adb install -g app-release.apk
adb logcat -c
adb shell monkey -p com.tandemgps -c android.intent.category.LAUNCHER 1
sleep 12
adb exec-out screencap -p > shots/01_profile.png
W=$(adb shell wm size | awk '{print $3}' | cut -dx -f1); H=$(adb shell wm size | awk '{print $3}' | cut -dx -f2)
adb shell input tap $((W/2)) $((H*88/100)); sleep 4
adb exec-out screencap -p > shots/02_trackmode_stationary.png
LAT=29.4241
for i in $(seq 1 25); do LAT=$(awk "BEGIN{printf \"%.6f\", $LAT+0.00027}"); adb emu geo fix -98.4936 "$LAT"; sleep 1; done
adb exec-out screencap -p > shots/03_trackmode_moving.png
adb logcat -d -b crash > shots/crash.txt
adb logcat -d | grep -E "ReactNativeJS|AndroidRuntime" | tail -200 > shots/js.txt
adb shell pidof com.tandemgps > shots/alive.txt || echo DEAD > shots/alive.txt
test -s shots/alive.txt && ! grep -q DEAD shots/alive.txt
