#!/usr/bin/env python3
"""Builds a road-following GPS drive in Sheridan, WY for the emulator.

Fetches a driving route from the public OSRM router (Coffeen Ave onto I-90),
then walks along it one fix per second at the speeds of a profile.
Prints "lon lat" per line. Usage: route.py walk|demo
"""
import json, math, sys, urllib.request

START = (-106.9440, 44.7790)   # Coffeen Ave, Sheridan, WY
END = (-106.8150, 44.6900)     # I-90 southeast of Sheridan, toward Buffalo
MPH = 0.44704                  # metres per second in 1 mph


def log(*a):
    print('ROUTE', *a, file=sys.stderr)


def fetch():
    url = ('https://router.project-osrm.org/route/v1/driving/'
           f'{START[0]},{START[1]};{END[0]},{END[1]}?overview=full&geometries=geojson&steps=true')
    for _ in range(3):
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                j = json.load(r)
            rt = j['routes'][0]
            pts = rt['geometry']['coordinates']
            steps = [s for leg in rt['legs'] for s in leg['steps']]
            return pts, steps
        except Exception as e:  # noqa: BLE001
            log('fetch failed', e)
    return None, None


def hav(a, b):
    R = 6371000.0
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dla, dlo = la2 - la1, math.radians(b[0] - a[0])
    h = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dlo / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


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
            road = f"{s.get('name', '')} {s.get('ref', '')}"
            log(f'{d:7.0f} m  {road.strip() or "(unnamed)"}')
            if hwy is None and 'Business' not in road and ('I 90' in road or 'I-90' in road):
                hwy = d
            d += s.get('distance', 0)
        log(f'route {cum[-1]:.0f} m, I-90 starts at {hwy} m')
    else:
        # Straight line north along Main St if the router cannot be reached.
        log('fallback straight line, router unreachable')
        pts = [(-106.9560, 44.7900), (-106.9560, 44.9000)]
        cum = [0.0, hav(pts[0], pts[1])]

    # Speed per second, in mph.
    sp = []
    if mode == 'walk':
        sp = [60] * 12 + [115] * 8
    else:
        def ramp(a, b, n):
            return [a + (b - a) * (i + 1) / n for i in range(n)]
        sp += ramp(0, 35, 8)
        city = 35.0
        if hwy is not None:
            # Hold city speed until the on-ramp, but keep that part under about 45 seconds.
            done = sum(v * MPH for v in sp)
            left = max(0.0, hwy - done)
            city = min(60.0, max(35.0, left / MPH / 45.0))
            n = int(left / (city * MPH))
            sp += ramp(35, city, 4) + [city] * max(0, n - 4)
        else:
            sp += [35] * 15
        sp += ramp(sp[-1], 75, 15) + [75] * 10 + ramp(75, 120, 12) + [120] * 8
        sp += ramp(120, 75, 8) + ramp(75, 45, 8) + ramp(45, 0, 8)

    d, out, i = 0.0, [], 0
    for v in sp:
        d = min(d + v * MPH, cum[-1])
        while i < len(cum) - 2 and cum[i + 1] < d:
            i += 1
        seg = cum[i + 1] - cum[i] or 1.0
        t = (d - cum[i]) / seg
        lon = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t
        lat = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
        out.append(f'{lon:.6f} {lat:.6f}')
    log(f'{mode}: {len(out)} fixes, {d:.0f} m driven')
    print(f'{pts[0][0]:.6f} {pts[0][1]:.6f}')  # first line is the parked start
    print('\n'.join(out))


if __name__ == '__main__':
    main()
