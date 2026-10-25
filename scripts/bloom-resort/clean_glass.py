"""Remove the dried water marks on the window glass behind the S4 window-seat shots (local, no AI).
The camera is locked off and the marks sit on the glass, so on the clip's still plate (per-pixel median) they are the crisp
fine detail; the foliage behind is out of focus. Only those pixels are masked and inpainted from their neighbours, frame by
frame, so the rest of the view keeps its detail. Anything moving (the hand) is left alone, as is the bright sky line.
usage: clean_glass.py [clip ...]  ->  Footage/_enhanced/<clip>_clean.mp4   (--test writes original | mask | cleaned jpgs)"""
import os, subprocess, sys
import numpy as np, cv2

FF = r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
E = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage\_enhanced"
THR = 11  # fine-detail level (plate minus its 3px blur) that counts as a mark
# 1280x720: glass area to search (x0, y0, x1, y1) and keep-out boxes (cup, cat). On the delivery and the stare the marks
# are on the right of the pane; searching wider catches real edges (sky line, wood slats, railing)
REG = {"S4_t01_sniff": ((650, 0, 1165, 640), [(600, 330, 900, 720), (560, 120, 725, 380)]),
       "S4_t02_delivery": ((1060, 90, 1280, 560), [(690, 350, 1120, 720)]),
       "S4_t05_beside-lens": ((1060, 90, 1280, 545), [(670, 350, 920, 690)])}


def frames(path):
    p = subprocess.Popen([FF, "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    while True:
        b = p.stdout.read(1280 * 720 * 3)
        if len(b) < 1280 * 720 * 3: return
        yield np.frombuffer(b, np.uint8).reshape(720, 1280, 3)


def marks(name, plate):
    g = cv2.cvtColor(plate, cv2.COLOR_BGR2GRAY).astype(np.float32)
    hp = np.abs(g - cv2.GaussianBlur(g, (0, 0), 3))
    (x0, y0, x1, y1), keep = REG[name]
    area = np.zeros((720, 1280), np.uint8); area[y0:y1, x0:x1] = 1
    for a, b, c, d in keep: area[b:d, a:c] = 0
    sky = cv2.dilate((g > 205).astype(np.uint8), np.ones((15, 15), np.uint8))
    m = ((hp > THR) & (area > 0) & (sky == 0)).astype(np.uint8)
    return cv2.dilate(m, np.ones((3, 3), np.uint8))  # each mark's soft rim too


def clean(f, m, plate):
    moving = (np.abs(f.astype(np.int16) - plate.astype(np.int16)).max(2) > 30).astype(np.uint8)
    moving = cv2.dilate(moving, np.ones((9, 9), np.uint8))
    return cv2.inpaint(f, (m & (1 - moving)) * 255, 5, cv2.INPAINT_TELEA)


def run(name, test=False):
    fs = list(frames(os.path.join(E, name + ".mp4")))
    plate = np.median(np.stack(fs[::4]), 0).astype(np.uint8)
    m = marks(name, plate)
    if test:
        f = fs[len(fs) // 2]; out = clean(f, m, plate)
        ov = f.copy(); ov[m > 0] = (0.4 * ov[m > 0] + 0.6 * np.array([40, 40, 255])).astype(np.uint8)
        (x0, y0, x1, y1), _ = REG[name]; sl = np.s_[y0:y1, x0:x1]; gap = np.full((y1 - y0, 8, 3), 255, np.uint8)
        cv2.imwrite(os.path.join(E, "_compare", f"{name}_glass.jpg"), np.hstack([f[sl], gap, ov[sl], gap, out[sl]]))
        return
    out = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "1280x720", "-r", "50",
                            "-i", "-", "-an", "-c:v", "libx264", "-crf", "14", "-preset", "slow", "-pix_fmt", "yuv420p",
                            os.path.join(E, name + "_clean.mp4")], stdin=subprocess.PIPE)
    for f in fs: out.stdin.write(clean(f, m, plate).tobytes())
    out.stdin.close(); out.wait()
    print(f"{name}: {len(fs)} frames, {m.mean() * 100:.1f}% of the frame repaired")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--test"] or list(REG)
    os.makedirs(os.path.join(E, "_compare"), exist_ok=True)
    for n in args: run(n, "--test" in sys.argv)
