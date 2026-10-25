"""Ep 1, 3-4s: one continuous pull-back from the eyes close-up (M5_t07 end) to the window-seat loaf (S1_t01 at 0.5s).
Kling 2.5 turbo first + last frame, 2 takes (~$0.35 each). Takes already on disk are skipped, so a re-run never pays twice."""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import falq

FF = r"C:\Users\Admin\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
FOOT = r"C:\Users\Admin\Videos\BloomPour\BloomResort_S1\Footage"
OUT = os.path.join(FOOT, "_ai_reveal")
PROMPT = ("One continuous shot, no cuts. The camera starts on an extreme close-up of a sleepy ragdoll cat's face, eyes half "
          "open, and slowly, smoothly dollies backwards, revealing that the same cat is lying in a fluffy loaf on a white round "
          "cat bed beside a window with sheer white curtains and a dark wall behind. The cat stays relaxed, only a slow blink. "
          "Soft natural window light, shallow depth of field, realistic, calm, cinematic.")
NEG = ("cut, scene change, morphing, second cat, extra legs, distorted face, warped fur, melting, flicker, blur, text, "
       "watermark, cartoon, CGI look, fast camera move")


def frame(src, t, path):
    if not os.path.exists(path):
        subprocess.run([FF, "-v", "error", "-y", "-ss", str(t), "-i", os.path.join(FOOT, src), "-frames:v", "1", path], check=True)
    return path


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    a = frame(r"_enhanced\M5_t07_reopen.mp4", 1.28, os.path.join(OUT, "start_eyes.png"))
    b = frame(r"_enhanced\S1_t01.mp4", 0.5, os.path.join(OUT, "end_loaf.png"))
    todo = [k for k in (1, 2) if not os.path.exists(os.path.join(OUT, f"reveal_k{k}.mp4"))]
    if todo:
        ua, ub = falq.upload(a, "image/png"), falq.upload(b, "image/png")
    for k in todo:
        r = falq.run("fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
                     {"prompt": PROMPT, "image_url": ua, "tail_image_url": ub, "duration": "5",
                      "cfg_scale": 0.5, "negative_prompt": NEG}, f"Ep1_reveal_k{k}", 0.35)
        falq.fetch(r["video"]["url"], os.path.join(OUT, f"reveal_k{k}.mp4"))
    print("takes:", sorted(f for f in os.listdir(OUT) if f.endswith(".mp4")))
