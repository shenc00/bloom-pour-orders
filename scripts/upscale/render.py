"""Final 9:16 upscale: 608x1080 crop of a 1920x1080 clip -> BasicVSR++ 4x -> area-down to 1080x1920 -> luma CAS 0.25
-> x264 crf 14, audio copied. Done in overlapping row bands and frame chunks (cross-faded) to fit 16 GB with no seams.
usage: render.py src.mp4 out.mp4 --x0 802 [--ss 3 --t 5]"""
import argparse, json, subprocess, time, numpy as np, torch, torch.nn.functional as F
import basicvsrpp

W, H = 608, 1080
BANDS, OV = 3, 72          # LR rows; band edges and OV are multiples of 9 so each band area-downscales onto whole output rows
CHUNK, PAD, BLEND = 12, 6, 4   # frames written per call, context frames each side, frames cross-faded at each chunk join
assert (H // BANDS) % 9 == 0 and OV % 9 == 0 and BLEND <= PAD


def ramp(n):
    return (torch.arange(n, device="cuda") + 1.0) / (n + 1)   # ramp(n) + flip(ramp(n)) == 1


def upscale(m, x):
    """x (t,3,1080,608) in 0..1 -> (t,3,1920,1080), bands cross-faded over their 2*OV overlap"""
    out, step, o = torch.zeros(x.shape[0], 3, 1920, 1080, device="cuda"), H // BANDS, 2 * OV * 16 // 9
    for k in range(BANDS):
        a, b = max(0, k * step - OV), min(H, (k + 1) * step + OV)
        oa, ob = a * 16 // 9, b * 16 // 9
        with torch.no_grad(), torch.autocast("cuda", torch.float16):   # fp16 measured 86 dB vs fp32: identical
            y = m(x[None, :, :, a:b], post=lambda hr: F.interpolate(hr.float().clamp(0, 1), size=(ob - oa, 1080), mode="area"))[0]
        w = torch.ones(ob - oa, device="cuda")
        if k > 0: w[:o] = ramp(o)
        if k < BANDS - 1: w[-o:] = ramp(o).flip(0)
        out[:, :, oa:ob] += y * w[:, None]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out"); ap.add_argument("--x0", type=int, required=True)
    ap.add_argument("--ss", default="0"); ap.add_argument("--t")
    a = ap.parse_args()
    v = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                                   "-of", "json", a.src], capture_output=True, text=True, check=True).stdout)["streams"][0]
    assert (v["width"], v["height"]) == (1920, 1080), "expects 1920x1080 input"
    assert 0 <= a.x0 <= 1920 - W
    cut = ["-ss", a.ss] + (["-t", a.t] if a.t else [])
    raw = subprocess.run(["ffmpeg", "-v", "error", *cut, "-i", a.src, "-vf", f"crop={W}:{H}:{a.x0}:0", "-f", "rawvideo",
                          "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3); n = len(frames)
    assert n >= 2, "need at least 2 frames"
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1080x1920", "-r", v["r_frame_rate"],
                            "-i", "-", *cut, "-i", a.src, "-map", "0:v", "-map", "1:a?", "-vf",
                            "format=yuv444p,cas=strength=0.25:planes=1,format=yuv420p", "-c:v", "libx264", "-crf", "14",
                            "-preset", "slow", "-c:a", "copy", "-shortest", "-movflags", "+faststart", a.out], stdin=subprocess.PIPE)
    m, t0, done, tail = basicvsrpp.load(), time.time(), 0, None
    for s in range(0, n, CHUNK):
        lo, hi = max(0, s - PAD), min(n, s + CHUNK + PAD)
        cur = upscale(m, torch.from_numpy(frames[lo:hi].copy()).cuda().permute(0, 3, 1, 2).float() / 255)[s - lo:]   # frames s..hi-1
        if tail is not None:   # previous chunk's look-ahead frames: cross-fade into this chunk
            k = min(BLEND, len(tail), len(cur)); w = ramp(k)[:, None, None, None]
            cur[:k] = tail[:k] * (1 - w) + cur[:k] * w
        for f in cur[:CHUNK]:
            enc.stdin.write((f.permute(1, 2, 0) * 255 + 0.5).clamp(0, 255).byte().cpu().numpy().tobytes()); done += 1
        tail = cur[CHUNK:]
    enc.stdin.close(); assert enc.wait() == 0, "encode failed"
    assert done == n
    print(f"{n} frames in {time.time() - t0:.0f}s ({n / (time.time() - t0):.2f} fps), peak VRAM "
          f"{torch.cuda.max_memory_allocated() / 2**30:.1f} GB -> {a.out}")


if __name__ == "__main__":
    main()
