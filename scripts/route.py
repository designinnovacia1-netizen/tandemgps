#!/usr/bin/env python3
"""Builds a road-following GPS drive in Sheridan, WY for the emulator.

Asks the public OSRM router for the drive from downtown Sheridan to Buffalo, WY
(which takes I-90), starts the ride in town a short way before the I-90 on-ramp,
and walks along the road one fix per second at speeds that suit each part:
town speed on the street, speeding up on the ramp, highway speed on I-90.
Prints "lon lat" per line; the first line is the parked start. Usage: route.py walk|demo
"""
import json, math, sys, urllib.request

START = (-106.9562, 44.7972)   # downtown Sheridan, WY
END = (-106.6989, 44.3483)     # Buffalo, WY
LEAD = 650                     # metres of town street before I-90
MPH = 0.44704                  # metres per second in 1 mph


def log(*a):
    print('ROUTE', *a, file=sys.stderr)


def fetch():
    url = ('https://router.project-osrm.org/route/v1/driving/'
           f'{START[0]},{START[1]};{END[0]},{END[1]}?overview=full&geometries=geojson&steps=true')
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                rt = json.load(r)['routes'][0]
            return rt['geometry']['coordinates'], [s for leg in rt['legs'] for s in leg['steps']]
        except Exception as e:  # noqa: BLE001
            log('fetch failed', e)
    return None, None


def hav(a, b):
    R = 6371000.0
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def ramp(a, b, n):
    return [a + (b - a) * (i + 1) / n for i in range(n)]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'demo'
    pts, steps = fetch()
    hwy = None
    if pts:
        cum = [0.0]
        for i in range(1, len(pts)):
            cum.append(cum[-1] + hav(pts[i - 1], pts[i]))
        d = 0.0
        for s in steps:
            road = f"{s.get('name', '')} {s.get('ref', '')}".strip()
            if d < 25000:
                log(f'{d:7.0f} m  {road or "(ramp or unnamed)"}')
            if hwy is None and 'Business' not in road and ('I 90' in road or 'I-90' in road):
                hwy = d
            d += s.get('distance', 0)
        log(f'route {cum[-1]:.0f} m, I-90 starts at {hwy} m')
        if hwy is not None and hwy > LEAD:
            j = max(i for i in range(len(cum)) if cum[i] <= hwy - LEAD)
            base = cum[j]
            pts, cum, hwy = pts[j:], [c - base for c in cum[j:]], hwy - base
            log(f'ride starts {hwy:.0f} m before I-90')
    else:
        log('fallback straight line, router unreachable')
        pts = [(-106.9560, 44.7900), (-106.9560, 44.9000)]
        cum = [0.0, hav(pts[0], pts[1])]

    if mode == 'walk':
        sp = [67] * 12 + [115] * 8
    else:
        # Town: up to 30 mph and hold it until about 250 m before I-90 (the ramp).
        sp = ramp(0, 30, 6)
        if hwy is not None:
            town = max(0.0, hwy - 250 - sum(v * MPH for v in sp))
            sp += [30] * int(town / (30 * MPH))
        else:
            sp += [30] * 15
        # Ramp and merge, then highway speeds on I-90, up into the top band and back down.
        sp += ramp(30, 70, 12) + [75] * 8 + ramp(75, 120, 12) + [120] * 8
        sp += ramp(120, 75, 10) + ramp(75, 0, 16)

    d, out, i = 0.0, [], 0
    for v in sp:
        d = min(d + v * MPH, cum[-1])
        while i < len(cum) - 2 and cum[i + 1] < d:
            i += 1
        seg = cum[i + 1] - cum[i] or 1.0
        t = (d - cum[i]) / seg
        out.append(f'{pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t:.6f} '
                   f'{pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t:.6f}')
    log(f'{mode}: {len(out)} fixes, {d:.0f} m driven, I-90 reached at fix '
        f'{next((n for n, x in enumerate(sp) if sum(sp[:n + 1]) * MPH >= (hwy or 1e9)), None)}')
    print(f'{pts[0][0]:.6f} {pts[0][1]:.6f}')
    print('\n'.join(out))


if __name__ == '__main__':
    main()
