#!/usr/bin/env python3

"""units - dump all units and their names from the xml on stdin."""

import sys
import xml.etree.ElementTree as ET


def _p(s, *args):
    if args:
        s = s % args
    sys.stdout.write(s)
    sys.stdout.write('\n')
    sys.stdout.flush()


def _main():
    tree = ET.parse(sys.stdin)
    unitidx = 0
    for unit in tree.getroot().findall("unit"):
        t = "vanilla"
        if unit.find("assessmentsession"):
            t = "schedules"
        elif unit.find("learningsession"):
            t = "optimized"

        name = ""
        n = unit.find("unitname")
        if n is not None:
            name = n.text

        _p("%4d %-12s %s", unitidx, t, name or "<NO NAME>")
        unitidx += 1


if __name__ == '__main__':
    try:
        _main()
    except Exception as e:
        sys.stderr.write("ERROR\n")
        sys.stderr.write(repr(e))
        sys.stderr.write("\n")
        sys.stderr.flush()
