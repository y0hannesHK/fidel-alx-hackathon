"""Join the recorded BSL clips into one sign-language track that matches the
lesson's timing: idle avatar between captions, each caption's signing placed at
the caption's start. Clips that would run into the next caption are sped up
(max 1.5x) or cut. Runs inside the Fidel server image (ffmpeg).

    python assemble.py /w/timeline.json /w/clips /w/sign-bsl.webm 159.0
"""
import json, subprocess, sys
from pathlib import Path

timeline, clips, out, total = json.load(open(sys.argv[1])), Path(sys.argv[2]), Path(sys.argv[3]), float(sys.argv[4])
work = Path(sys.argv[1]).parent / "segments"; work.mkdir(exist_ok=True)  # next to timeline.json
W, H, FPS, BG = 320, 360, 25, "0xA9BCD6"   # light blue, like the live avatar window; sign-window shape
# Recorded canvas has no background (black): key out pure black, lay over light blue.
# Upper body only (hands and face carry sign language): centre crop of the 638x478 canvas.
look = f"colorkey=0x000000:0.03:0.0,crop=318:358:160:0,scale={W}:{H}:flags=lanczos,fps={FPS}"
enc = ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "50", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", "-pix_fmt", "yuv420p", "-an"]

def run(args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)

def segment(name, src, seconds, speed=1.0, loop=False):
    path = work / name
    inp = (["-stream_loop", "-1"] if loop else []) + ["-i", str(src)]
    vf = f"[1:v]setpts=PTS/{speed},{look}[fg];[0:v][fg]overlay=shortest=0:eof_action=repeat,trim=duration={seconds:.3f},setpts=PTS-STARTPTS[v]"
    run(["-f", "lavfi", "-i", f"color=c={BG}:s={W}x{H}:r={FPS}:d={seconds:.3f}", *inp, "-filter_complex", vf, "-map", "[v]", *enc, str(path)])
    return path

parts, t, report = [], 0.0, []
cues = timeline["cues"]
for i, cue in enumerate(cues):
    if not cue["clip"]:
        continue
    start = max(cue["start"], t)
    limit = (cues[i + 1]["start"] if i + 1 < len(cues) else total) - start
    if start > t + 0.04:
        parts.append(segment(f"gap{i:02d}.webm", clips / "idle.webm", start - t, loop=True))
    speed = min(1.5, max(1.0, cue["clip_s"] / limit))
    length = min(cue["clip_s"] / speed, limit)
    parts.append(segment(f"cue{i:02d}.webm", clips / cue["clip"], length, speed=speed))
    report.append(f'{i:2d} at {start:6.1f}s  {length:4.1f}s  speed {speed:.2f}  {" ".join(cue["signed"])}')
    t = start + length
if total > t + 0.04:
    parts.append(segment("gapend.webm", clips / "idle.webm", total - t, loop=True))

listing = work / "list.txt"
listing.write_text("".join(f"file '{p.name}'\n" for p in parts))
run(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(out)])
print("\n".join(report))
