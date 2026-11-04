#!/usr/bin/env python3
"""Reads a uiautomator dump on stdin and prints the center of the node with this content description."""
import re,sys
xml=sys.stdin.read();label=sys.argv[1]
for m in re.finditer(r'<node [^>]*>',xml):
    n=m.group(0)
    if f'content-desc="{label}"' in n:
        b=re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"',n)
        if b:
            x0,y0,x1,y1=map(int,b.groups());print((x0+x1)//2,(y0+y1)//2);break
