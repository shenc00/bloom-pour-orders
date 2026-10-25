"""Light denoise + luma-only CAS sharpen of the picks and their next-best trimmed backup, into Footage/_enhanced.
usage: enhance.py [clip ...]   (no args = the whole list)"""
import os, sys, subprocess, json, numpy as np, cv2
from concurrent.futures import ThreadPoolExecutor

T = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage\_trimmed"
OUT = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage\_enhanced"
CMP = os.path.join(OUT, "_compare")
# pick, then the next-best trimmed backup (from the series plan); frames with raw-only backups have just the pick
CLIPS = """Z1_t01_night Z2_t01 Z4_t02_lantern Z4_t01_static
S1_t01 S8_t01 S10_t01 S12_t01 S12_t02_early
T4_t02_bokeh M2_t02 M3_t02_stream X_bloom-bubbles_t01 X_cup-pour_t01 X_brew-side_t01 S3_t01 Z1_t04_dusk-lightson_fix Z1_t04_dusk-lightson Z4_t03_ramp Z4_t04_clubhouse Z6_t01 Z7_t01_entrance Z7_t02_lift Z7_t03_lift M3_t01_clean M3_t01 M6b_t01 M5_t06 M5_t04 M7_t02 M8_t03_slowblink M8_t02 M8_t01 X_sleep-face-macro_t01
T4_t01 T5_t01 T5_t02 T9_t01 T9_t03 T10_t01_thirds
F1_t01 F1_t02_inspect F2_t03_haze F2_t02 F3_t06 F3_t01 F4_t03 F4_t01_haze F4_t02_haze
F5_t04 F5_t03 F6_t08 F6_t01_clean F7_t02_chope F7_t03_chope-dusk F8_t01 F8_t02
Z1_t02_day Z1_t03_day Z3_t01_wide Z3_t02_seat Z5_t01 Z5_t02 X_pool-towers_t01""".split()
STABILISED = {"F2_t02", "F4_t03", "F5_t03", "T10_t01_thirds"}   # vidstab pass may already have sharpened them
K = np.array([[1, -2, 1], [-2, 4, -2], [1, -2, 1]], np.float32)


def probe(p):
    s = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                   "stream=width,height,pix_fmt:format=duration", "-of", "json", p],
                                  capture_output=True, text=True).stdout)
    v = s["streams"][0]; return v["width"], v["height"], v["pix_fmt"], float(s["format"]["duration"])


def frame(p, t, w, h):
    r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-f", "rawvideo",
                        "-pix_fmt", "bgr24", "-"], capture_output=True).stdout
    return np.frombuffer(r, np.uint8).reshape(h, w, 3)


def noise(g):
    """Immerkaer noise sigma on the lit pixels (the fisheye's black surround would read as zero noise)"""
    r = np.abs(cv2.filter2D(g, -1, K))[1:-1, 1:-1]; m = (g[1:-1, 1:-1] > 12) & (g[1:-1, 1:-1] < 243)
    return float(np.sqrt(np.pi / 2) * r[m].mean() / 6)


def acutance(g):
    """mean of the strongest 1% Sobel edges: tracks edge crispness more than grain does"""
    m = cv2.magnitude(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))
    return float(np.percentile(m, 99))


def settings(name, n):
    if n < 1.0:   dn, s = "1.2:1.5:2.5:3", 0.5      # clean (x264 trims measure 0.4-0.9)
    elif n < 2.0: dn, s = "1.8:2.2:3.5:4", 0.4
    else:         dn, s = "2.6:3:4.5:5", 0.3        # night / high ISO: denoise more, sharpen less
    if name in STABILISED: s -= 0.15
    if name == "F7_t03_chope-dusk": dn, s = None, 0.3   # denoise smooths the plate more than the pasted sign's grain, and CAS lifts the sign's clumpier grain more: light sharpen only
    return dn, round(s, 2)


def gray(img):
    return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)


def one(name):
    src, dst = os.path.join(T, name + ".mp4"), os.path.join(OUT, name + ".mp4")
    w, h, pf, d = probe(src)
    t = d / 2; before = frame(src, t, w, h)
    n = noise(gray(before)); dn, s = settings(name, n)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-map", "0:v", "-map", "0:a?",
                    "-vf", (f"hqdn3d={dn}," if dn else "") + f"cas=strength={s}:planes=1", "-c:v", "libx264", "-crf", "14", "-preset", "slow",
                    "-pix_fmt", pf, "-c:a", "copy", "-movflags", "+faststart", dst], check=True)
    after = frame(dst, t, w, h)
    # 2x crop of the most detailed window, before | after
    g = gray(before); cw, ch = w // 6, h // 6
    e = cv2.boxFilter(np.abs(cv2.Laplacian(g, cv2.CV_32F)), -1, (cw, ch))
    e[:ch // 2], e[-ch // 2:], e[:, :cw // 2], e[:, -cw // 2:] = 0, 0, 0, 0
    cy, cx = np.unravel_index(np.argmax(e), e.shape); y0, x0 = cy - ch // 2, cx - cw // 2
    crops = [cv2.resize(i[y0:y0 + ch, x0:x0 + cw], None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST) for i in (before, after)]
    bar = np.full((8, crops[0].shape[1] * 2 + 8, 3), 255, np.uint8)
    sheet = np.vstack([np.hstack([crops[0], np.full((crops[0].shape[0], 8, 3), 255, np.uint8), crops[1]]), bar])
    cv2.putText(sheet, f"{name}  before | after  dn {dn}  cas {s}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
    cv2.imwrite(os.path.join(CMP, name + ".jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 92])
    nb, na = probe(src)[3], probe(dst)[3]
    return (f"{name:24s} {w}x{h} noise {n:4.1f}->{noise(gray(after)):4.1f}  edge {acutance(gray(before)):5.0f}->"
            f"{acutance(gray(after)):5.0f}  dn {str(dn):13s} cas {s:.2f}  dur {nb:.2f}/{na:.2f}")


if __name__ == "__main__":
    os.makedirs(CMP, exist_ok=True)
    names = sys.argv[1:] or CLIPS
    assert all(os.path.exists(os.path.join(T, c + ".mp4")) for c in names), "missing clip"
    with ThreadPoolExecutor(3) as ex:
        for line in ex.map(one, names):
            print(line, flush=True)
