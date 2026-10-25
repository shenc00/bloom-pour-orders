"""Paint out the picture frame Kling invented on the wall (top-left, 1.85-3.4s of reveal_k1) with the surrounding wall.
Box keyframes (time, left, right, bottom; top is 0) were read off a gridded contact sheet; filled row by row with the wall
colour just right of the box (plain wall there), feathered back in.  -> _ai_reveal/reveal_k1_clean.mp4"""
import os, subprocess
import numpy as np, cv2

FF = r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
D = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage\_ai_reveal"
W, H, FPS = 1920, 1080, 24
KEYS = [(1.70, 1000, 1330, 50), (1.95, 790, 1230, 140), (2.20, 430, 830, 230), (2.45, 90, 580, 340),
        (2.70, 0, 370, 410), (2.95, 0, 200, 490), (3.20, 0, 70, 545), (3.45, 0, 20, 570)]
PAD = 90


def box(t):
    if not KEYS[0][0] <= t <= KEYS[-1][0]: return None
    ts = [k[0] for k in KEYS]
    return [int(np.interp(t, ts, [k[i] for k in KEYS])) for i in (1, 2, 3)]


if __name__ == "__main__":
    src = subprocess.Popen([FF, "-v", "error", "-i", os.path.join(D, "reveal_k1.mp4"), "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                           stdout=subprocess.PIPE)
    out = subprocess.Popen([FF, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-an", "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-pix_fmt", "yuv420p",
                            os.path.join(D, "reveal_k1_clean.mp4")], stdin=subprocess.PIPE)
    n = 0
    while True:
        b = src.stdout.read(W * H * 3)
        if len(b) < W * H * 3: break
        f = np.frombuffer(b, np.uint8).reshape(H, W, 3).copy()
        bx = box(n / FPS)
        if bx:
            x0, x1, y1 = max(0, bx[0] - PAD), min(W, bx[1] + PAD + 60), min(H, bx[2] + 20)  # the bright edge is on the right; the cat hides the frame's lower part, so stay off its back
            m = np.zeros((H, W), np.float32); m[0:y1, x0:x1] = 1
            # each row continues the wall colour found just right of the box (plain wall there), smoothed top to bottom
            strip = f[0:y1, x1:min(W, x1 + 80)].astype(np.float32)
            row = np.median(strip, axis=1)
            wall = np.abs(row - np.median(row[:40], 0)).max(1) < 14  # close to the plain wall at the top: not fur, not the frame's edge
            for y in range(1, len(row)):  # rows that hit the cat take the last good wall row above them
                if not wall[y]: row[y] = row[y - 1]
            row = cv2.GaussianBlur(row[:, None, :], (0, 0), 25)[:, 0, :]
            fill = f.astype(np.float32).copy(); fill[0:y1, :] = row[:, None, :]
            fill += np.random.normal(0, 2.0, fill.shape).astype(np.float32)  # keep the grain so the patch does not look flat
            a = cv2.GaussianBlur(m, (0, 0), 18)[..., None]
            f = (f * (1 - a) + fill * a).astype(np.uint8)
        out.stdin.write(f.tobytes()); n += 1
    out.stdin.close(); out.wait()
    print(n, "frames")
