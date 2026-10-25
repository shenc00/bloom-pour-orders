"""BloomResort Ep 1 review cut v9: 16:9 1920x1080 with 2.39:1 letterbox, silent, local only (no AI / fal calls).
Stage 1, per shot -> shots/NN_<name>.mp4 (1920x804 active picture): trim, true slow motion on 50p sources,
  fill crop at a chosen height, eased push-in, exposure + white-balance match to its group reference,
  group tint (warm room / cool grey haze, per the series haze look).
Stage 2, join: dissolves / cuts -> one filmic LOOK over the whole sequence (so every shot gets the same
  curve, split tone, halation, vignette and grain), letterbox, fade in; then black + credits.
usage: python ep1_cut.py [shot-name ...]   (no args = every shot; always re-joins)"""
import os, subprocess, sys
import numpy as np, cv2

BIN = r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin"
FF, FP = BIN + r"\ffmpeg.exe", BIN + r"\ffprobe.exe"
FOOT = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage"
OUT = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Ep1_cut_v9"
SHOTS = os.path.join(OUT, "shots")
W, H, AH, FPS = 1920, 1080, 804, 25    # frame, frame height, active picture height (2.39:1), fps
PC, PY, PD = W // 2, AH // 2, 780      # porthole centre and diameter inside the active picture
RING = (0xDE, 0xE5, 0xDE)              # brand sage-cream rim ring
ENC = ["-an", "-c:v", "libx264", "-crf", "15", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS)]

TINT = {  # series colour story: warm and gold inside, cool grey outside
    "room": "colorbalance=rm=0.02:bm=-0.02:rh=0.015:bh=-0.02,eq=saturation=0.90",
    "haze": "colorbalance=rs=-0.01:bs=0.02:rm=-0.01:bm=0.015,eq=saturation=0.74:contrast=1.03",
}
REF = {"room": "03_guest", "haze": "05_pool"}
# per-shot trims after the group match, measured on the joined cut: pool and city meet in the middle
# (pool was dark and saturated, city milky and yellow)
TRIM = {"05_pool": "eq=gamma=1.35:saturation=0.80",
        "06_haze_layers": "curves=all='0/0 0.25/0.14 0.75/0.66 1/0.96',eq=saturation=1.04,colorbalance=bm=0.05:bh=0.05:rm=-0.01"}
# filmic look, once over the joined sequence: lifted blacks + soft highlight roll-off, teal shadows / amber
# highlights, warm halation round the bright edges (window, steam, glass), vignette, moving grain
LOOK = ("format=gbrp,"
        "curves=master='0/0.025 0.12/0.095 0.5/0.5 0.85/0.875 1/0.955',"
        "colorbalance=rs=-0.03:gs=-0.005:bs=0.03:rh=0.03:gh=0.01:bh=-0.03:pl=1,"
        "split[la][lb];[lb]curves=all='0/0 0.74/0 1/1',gblur=sigma=26,"
        "colorchannelmixer=rr=1:gg=0.6:bb=0.4[lh];"
        "[la][lh]blend=all_mode=screen:all_opacity=0.14,"
        "format=yuv420p,vignette=angle=0.36,noise=c0s=5:c0f=t+u")

# name, source, src in, src out, speed, group, framing (crop height 0-1, "porthole", or a source crop x,y,w,h), push, join in
# join in = dissolve seconds into this shot (0 = cut). Lengths on screen = (out - in) / speed.
CUT = [
    ("01_bloom", r"M1\M1_graded_porthole_0218_x1.5.mp4", 0.5, 1.7, 0.5, "room", "porthole", 0, 0),
    ("02_eyes", r"_enhanced\M5_t07_reopen.mp4", 0.2, 1.3, 0.5, "room", 0.85, 0, 0),  # match cut, eye opens; framed like the reveal and the guest so the next two cuts are invisible
    ("02b_reveal", r"_ai_reveal\reveal_k1_clean.mp4", 0.0, 5.04, 2.2, "room", 0.85, 0, 0),  # AI (Kling, first+last frame): pulls back from the face to the loaf; fix_reveal.py painted out a fake wall frame
    ("03_guest", r"_enhanced\S1_t01.mp4", 0.5, 3.4, 1.0, "room", 0.85, 0, 0),          # starts on the reveal's last frame; 0:06-0:11 trimmed to 2.5s (25 Oct)
    ("04_gaze", r"_trimmed\X_gaze-window_t01.mp4", 3.0, 6.5, 1.0, "room", 0.1, 0.03, 0),  # profile out the window, no glass reflections (F2 fisheye had them)
    ("05_pool", r"_enhanced\T5_t01.mp4", 0.0, 4.6, 1.0, "haze", "move", 0, 0),          # same screen direction, tilts up
    ("06_haze_layers", r"_enhanced\T9_t01.mp4", 1.0, 6.2, 1.0, "haze", "move", 0, 1.2),  # rises off the treetops, then the cat looks left, then right
    ("07_pour", r"_enhanced\S3_t01.mp4", 1.6, 5.2, 1.0, "room", 0.6, 0.04, 0.5),
    ("08_ear", r"_enhanced\S1_t01.mp4", 8.4, 10.8, 1.0, "room", (420, 190, 860, 360), 0.02, 0),  # same loaf: head lifts, ears perk at the pour
    ("09_drip", r"_enhanced\M3_t01_clean.mp4", 6.0, 7.5, 0.5, "room", 0.7, 0.03, 0),
    # S4 window shots: *_clean = clean_glass.py took the dried water marks off the pane
    ("10_delivery", r"_enhanced\S4_t02_delivery_clean.mp4", 0.0, 4.0, 1.0, "room", 0.8, 0.03, 0.4),
    ("12_sniff", r"_enhanced\S4_t01_sniff_clean.mp4", 1.2, 2.7, 0.5, "room", (150, 240, 900, 376), 0.03, 0),  # insert, cut on the lean-in: nose to the lid
    ("13_stare", r"_enhanced\S4_t05_beside-lens_clean.mp4", 1.5, 4.0, 1.0, "room", 0.0, 0.03, 0),  # beside the cup, flat stare into the lens: verdict?
]
IRIS = (None, 0.8)   # shot, closing seconds at its end (v3: off, the cat's-eye shot is no longer a circle)
FADE_IN, BLACK = 0.8, 0.4
CREDITS = r"M1\M1_credits_logo_9x16.mp4"
# credits: from the first bubbles (1.0s) to the finished logo (3.7s) at 1.5x, then hold; the text (rows 1470-1610 of the
# 9:16 card, lifted from its last frame) rolls up into place as the bubbles appear instead of after the logo
CRED_IN, CRED_OUT, CRED_SP, CRED_HOLD, TEXT_Y, TEXT_H = 1.0, 3.7, 1.5, 1.2, 1470, 140


def ease(a, b):  # smoothstep 0 -> 1 over progress P in [a, b]
    return f"(clip((P-{a})/{b - a},0,1)*clip((P-{a})/{b - a},0,1)*(3-2*clip((P-{a})/{b - a},0,1)))"


# camera moves: zoom start/end, window centre start/end (fractions of the source), eased; or (z, cx, cy) expressions in P (0 -> 1)
MOVE = {"05_pool": (1.2, 1.25, 0.5, 0.58, 0.5, 0.44),
        # the cat's head turns: drift up off the treetops, look left, pause, look right
        "06_haze_layers": ("1.35", f"(0.5-0.13*{ease(0.05, 0.42)}+0.26*{ease(0.55, 1)})", f"(0.6-0.08*{ease(0, 0.4)})"),
}
POV = {"05_pool", "06_haze_layers"}  # the cat's view, through its eyes (pov_frame()); the eye opens on the first
# 02 -> 03 face match: the eyes close-up shrinks (0.6x), slides and rotates level onto the guest's face while it fades.
# Face points measured on the 1920x804 shots: eyes (952,448), eye line -11.5 deg; guest at 2x zoom (1333,402).
def _face():  # xfade custom expr; st()/ld() registers are unsafe in xfade (garbage), so everything is inlined
    q = "((1-cos(PI*(1-P)))/2)"  # eased progress, P runs 1 -> 0
    dx, dy = f"(X*1920/W-952-381*{q})", f"(Y*804/H-448+46*{q})"
    th, sc = f"(0.2007*{q})", f"(1-0.4*{q})"
    ax, ay = f"(952+({dx}*cos({th})+{dy}*sin({th}))/{sc})", f"(448+({dy}*cos({th})-{dx}*sin({th}))/{sc})"
    edge = f"clip(min(min({ax},1919-{ax}),min({ay},803-{ay}))/(1+700*sqrt({q})),0,1)"  # edges feather in as it shrinks: no hard rectangle, no pop
    al = f"({edge}*(1-{q}))"
    a = f"if(eq(PLANE,0),a0({ax},{ay}),if(eq(PLANE,1),a1({ax}*W/1920,{ay}*H/804),a2({ax}*W/1920,{ay}*H/804)))"
    return f"{a}*{al}+B*(1-{al})"


FACE = _face()
XFADE = {}  # shot -> xfade transition into it (default: fade)
PORT_SRC = {"01_bloom": (960, 540, 920), "04_catseye": (952, 538, 920)}  # circle centre + square side in source


def run(cmd):
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode:
        sys.exit(r.stderr.decode(errors="replace")[-2000:])
    return r


def framing(name, src, fy):
    """fill the 1920x804 active picture at crop height fy, or the porthole square"""
    if fy == "porthole":
        x, y, s = PORT_SRC[name]
        return f"crop={s}:{s}:{x - s // 2}:{y - s // 2},scale={PD}:{PD}:flags=lanczos"
    if fy == "move":  # full frame; build() picks the moving 2.39 window
        return f"scale={W}:{W * 9 // 16}:flags=lanczos"
    if isinstance(fy, tuple):
        x, y, w, h = fy
        return f"crop={w}:{h}:{x}:{y},scale={W}:{AH}:flags=lanczos"
    sw, sh = map(int, run([FP, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                           "-of", "csv=p=0", os.path.join(FOOT, src)]).stdout.split(b","))
    sh2 = round(sh * W / sw)
    return f"scale={W}:{sh2}:flags=lanczos,crop={W}:{AH}:0:{round((sh2 - AH) * fy)}"


def measure(path, a, b, frame):
    r = run([FF, "-v", "error", "-ss", f"{a}", "-to", f"{b}", "-i", path, "-vf",
             f"fps=4,{frame},scale=240:-2,format=rgb24", "-f", "rawvideo", "-"])
    x = np.frombuffer(r.stdout, np.uint8).reshape(-1, 240, 3).astype(float)
    y = x.mean(-1)
    m = (y > 30) & (y < 225)  # midtones only: blown window and black surround don't vote
    rgb = np.array([x[..., c][m].mean() for c in range(3)])
    return rgb / rgb.mean(), float(y[m].mean())


def matte():
    """black outside the porthole + the rim ring; transparent inside"""
    p = os.path.join(OUT, "porthole_matte.png")
    if not os.path.exists(p):
        img = np.zeros((AH, W, 4), np.uint8); img[..., 3] = 255
        cv2.circle(img, (PC, PY), PD // 2 - 3, (0, 0, 0, 0), -1, cv2.LINE_AA)
        cv2.circle(img, (PC, PY), PD // 2 - 3, (*RING[::-1], 255), 5, cv2.LINE_AA)
        cv2.imwrite(p, img)
    return p


EYE_OPEN = 18  # frames for the cat's eye to open at the start of the view
CAT_COLOUR = "colorchannelmixer=rr=0.62:rg=0.38:gr=0.32:gg=0.68,eq=saturation=0.88:gamma=1.04"  # cats see blues and yellows, reds dull


def pov_frame():
    """through the cat's eyes: an almond-shaped eye frame (tips just off-screen) that opens over EYE_OPEN frames, soft
    out-of-focus whiskers rising from both lower corners, and a mask that blurs the edges of the eye (sharp centre).
    -> pov/eye_%03d.png (the last one is the open eye), pov/edge_blur.png"""
    d = os.path.join(OUT, "pov")
    last = os.path.join(d, f"eye_{EYE_OPEN:03d}.png")
    if os.path.exists(last):
        return os.path.join(d, "eye_%03d.png"), last, os.path.join(d, "edge_blur.png")
    os.makedirs(d, exist_ok=True)
    yy, xx = np.mgrid[0:AH, 0:W].astype(np.float32)
    u = (xx - W / 2) / (0.56 * W)
    lens = np.clip(1 - u ** 2, 0, 1)                      # almond half-height profile, pointed at the tips
    full = 0.56 * AH * lens                               # fully open: top and bottom edge just off-screen at the centre
    dy = np.abs(yy - AH / 2)
    edge = np.clip(np.maximum(dy / np.maximum(full, 1), np.abs(u) * 0.95), 0, 1)
    cv2.imwrite(os.path.join(d, "edge_blur.png"), (np.clip((edge - 0.5) / 0.4, 0, 1) * 255).astype(np.uint8))
    wh = np.zeros((AH, W), np.float32)                    # whiskers: three per side, curving up toward the centre
    for side in (1, -1):
        for k, (ex, ey) in enumerate(((620, 600), (700, 690), (560, 760))):
            p0, p1 = np.array([-60, AH + 30 + 25 * k]), np.array([ex, ey])
            c = (p0 + p1) / 2 + np.array([60, 80 + 30 * k])
            pts = [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1 for t in np.linspace(0, 1, 60)]
            pts = np.array([[W - x if side < 0 else x, y] for x, y in pts], np.int32)
            cv2.polylines(wh, [pts], False, 1.0, 5 - k, cv2.LINE_AA)
    wh = cv2.GaussianBlur(wh, (0, 0), 4) * 0.6
    for i in range(EYE_OPEN + 1):
        s = 0.04 + 0.96 * (1 - np.cos(np.pi * i / EYE_OPEN)) / 2
        lid = np.clip((dy - full * s) / 28 + 0.5, 0, 1) * 0.96            # outside the eye: near black
        lid = np.maximum(lid, np.clip((np.abs(u) - 0.9) / 0.12, 0, 1) * 0.96)
        a = np.maximum(lid, wh * (1 - lid))
        col = (wh * (1 - lid))[..., None] * np.array([228, 230, 232], np.float32) / np.maximum(a[..., None], 1e-3)
        img = np.dstack([col, a * 255]).clip(0, 255).astype(np.uint8)
        cv2.imwrite(os.path.join(d, f"eye_{i:03d}.png"), cv2.GaussianBlur(img, (0, 0), 3))
    return os.path.join(d, "eye_%03d.png"), last, os.path.join(d, "edge_blur.png")


def length(c):
    return round((c[3] - c[2]) / c[4] * FPS) / FPS


def build(meas, name, src, a, b, sp, group, fy, push, _join):
    ratio, y = meas[name]
    ref_ratio, ref_y = meas[REF[group]]
    gain = np.clip((ref_ratio / ratio) ** 0.5, 0.94, 1.06)  # half-way toward the group's cast
    gamma = float(np.clip(np.log(max(y, 20) / 255) / np.log(ref_y / 255), 0.88, 1.15))
    n = round((b - a) / sp * FPS)
    f = [f"setpts=(PTS-STARTPTS)/{sp}", f"fps={FPS}", framing(name, src, fy)]  # 50p at 0.5x = every real frame
    if name in MOVE:
        mv = MOVE[name]
        if isinstance(mv[0], str):
            z, cx, cy = (s.replace("P", f"(on/{n - 1})") for s in mv)
        else:
            z0, z1, x0, y0, x1, y1 = mv
            e = f"(1-cos(PI*on/{n - 1}))/2"
            z, cx, cy = (f"({p0}+({p1}-{p0})*{e})" for p0, p1 in ((z0, z1), (x0, x1), (y0, y1)))
        fh = W * 9 // 16 if fy == "move" else AH  # "move": window over the full frame, then the 2.39 band
        f.append(f"scale={W * 2}:{fh * 2}:flags=bicubic,zoompan=z='{z}':d=1:"
                 f"x='clip({cx}*iw-iw/zoom/2,0,iw-iw/zoom)':y='clip({cy}*ih-ih/zoom/2,0,ih-ih/zoom)':"
                 f"s={W}x{fh}:fps={FPS},crop={W}:{AH}")
    if push:  # eased slow dolly-in, computed at 2x so it is sub-pixel smooth
        e = f"(1-cos(PI*on/{n - 1}))/2"
        f.append(f"scale={W * 2}:{AH * 2}:flags=bicubic,zoompan=z='1+{push}*{e}':d=1:"
                 f"x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':s={W}x{AH}:fps={FPS}")
    f.append(f"colorchannelmixer=rr={gain[0]:.3f}:gg={gain[1]:.3f}:bb={gain[2]:.3f},eq=gamma={gamma:.3f},{TINT[group]}" + (f",{TRIM[name]}" if name in TRIM else ""))
    if name == IRIS[0]:  # circle closes from the full frame down to the porthole rim
        t0, r0, r1 = n / FPS - IRIS[1], float(np.hypot(PC, PY)), PD / 2 - 3
        R = f"({r0}+({r1}-{r0})*(1-cos(PI*min(max(T-{t0},0)/{IRIS[1] - 1 / FPS},1)))/2)"
        m = f"lte(hypot(X-{PC},Y-{PY}),{R})"
        f.append(f"format=gbrp,geq=r='r(X,Y)*{m}':g='g(X,Y)*{m}':b='b(X,Y)*{m}'")
    chain = ",".join(f)
    out = os.path.join(SHOTS, name + ".mp4")
    inp = [FF, "-v", "error", "-y", "-ss", f"{a}", "-to", f"{b}", "-i", os.path.join(FOOT, src)]
    if fy == "porthole":
        g = f"[0:v]{chain},pad={W}:{AH}:{PC - PD // 2}:{PY - PD // 2}:black[v];[v][1:v]overlay=0:0,format=yuv420p"
        run(inp + ["-loop", "1", "-i", matte(), "-filter_complex", g, "-frames:v", str(n)] + ENC + [out])
    elif name in POV:  # cat's eyes: cat colour, blurred edges, the eye frame (opening on the first POV shot) + whiskers
        seq, last, blur = pov_frame()
        eye = ["-framerate", str(FPS), "-i", seq] if name == min(POV) else ["-loop", "1", "-i", last]
        g = (f"[0:v]{chain},{CAT_COLOUR},format=gbrp,split[s][b];[b]gblur=sigma=9[bb];[2:v]format=gbrp[mk];"
             f"[s][bb][mk]maskedmerge[m];[m][1:v]overlay=0:0,format=yuv420p,setsar=1")
        run(inp + eye + ["-loop", "1", "-i", blur, "-filter_complex", g, "-frames:v", str(n)] + ENC + [out])
    else:
        run(inp + ["-vf", chain + ",format=yuv420p,setsar=1", "-frames:v", str(n)] + ENC + [out])
    print(f"{name:15s} {n / FPS:4.1f}s  x{sp}  gain {np.round(gain, 3)}  gamma {gamma:.3f}")


def join():
    ins, g, prev, t = [], [], "[0:v]", length(CUT[0])
    for i, c in enumerate(CUT):
        ins += ["-i", os.path.join(SHOTS, c[0] + ".mp4")]
        if i:
            d = c[8] or 1 / FPS  # a cut is a one-frame xfade
            g.append(f"{prev}[{i}:v]xfade=transition={XFADE.get(c[0], "fade")}:duration={d}:offset={t - d:.3f}[x{i}]")
            prev, t = f"[x{i}]", t - d + length(c)
    g.append(f"{prev}{LOOK},pad={W}:{H}:0:{(H - AH) // 2}:black,fade=in:d={FADE_IN},setsar=1[out]")
    main = os.path.join(SHOTS, "_main.mp4")
    run([FF, "-v", "error", "-y", *ins, "-filter_complex", ";".join(g), "-map", "[out]"] + ENC + [main])
    tail = os.path.join(SHOTS, "14_black_credits.mp4")  # credits: the 9:16 logo card centred in the letterbox
    cred = os.path.join(FOOT, CREDITS)
    tg = (f"[0:v]setpts=(PTS-STARTPTS)/{CRED_SP},fps={FPS},tpad=stop_mode=clone:stop_duration={CRED_HOLD},"
          f"drawbox=x=0:y={TEXT_Y}:w=iw:h={TEXT_H}:color=black:t=fill[card];"  # the card's own late text: replaced below
          f"[1:v]crop=1080:{TEXT_H}:0:{TEXT_Y},split[tc][ta];[ta]format=gray[tm];[tc][tm]alphamerge,"  # white text, its own luma as alpha
          f"fade=in:st=0.15:d=0.7:alpha=1[txt];"
          f"[card][txt]overlay=0:'{TEXT_Y}+36*(1-min(t/0.85,1))^2':eval=frame:shortest=0,"
          f"crop=1080:1220:0:380,scale=-2:{AH}:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black,"
          f"tpad=start_duration={BLACK}:color=black,fade=in:st={BLACK}:d=0.4,setsar=1")
    last = os.path.join(OUT, "credits_last.png")  # the finished card, text and all
    run([FF, "-v", "error", "-y", "-ss", "7.5", "-i", cred, "-frames:v", "1", last])
    run([FF, "-v", "error", "-y", "-ss", f"{CRED_IN}", "-to", f"{CRED_OUT}", "-i", cred,
         "-loop", "1", "-i", last, "-filter_complex", tg,
         "-frames:v", str(round((BLACK + (CRED_OUT - CRED_IN) / CRED_SP + CRED_HOLD) * FPS))] + ENC + [tail])
    lst = os.path.join(OUT, "concat.txt")
    with open(lst, "w") as f:
        f.write(f"file '{main}'\nfile '{tail}'\n")
    final = os.path.join(OUT, "Ep1_review_v9.mp4")
    run([FF, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", "-movflags", "+faststart", final])
    print(f"-> {final}  (main {t:.1f}s + credits)")


if __name__ == "__main__":
    os.makedirs(SHOTS, exist_ok=True)
    meas = {c[0]: measure(os.path.join(FOOT, c[1]), c[2], c[3], framing(c[0], c[1], c[6])) for c in CUT}
    for n in ("02_eyes", "02b_reveal"):  # one continuous move into the guest: share its grade, no jumps at the cuts
        meas[n] = meas["03_guest"]
    names = sys.argv[1:] or [c[0] for c in CUT]
    for c in CUT:
        if c[0] in names:
            build(meas, *c)
    join()
