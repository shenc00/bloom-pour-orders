"""BasicVSR++ (Chan et al. 2022) in plain PyTorch, key-compatible with the OpenMMLab checkpoint
weights/basicvsr_plusplus_c64n7_8x1_600k_reds4_20210217-db622b2f.pth (Apache 2.0). Deformable conv via torchvision,
so no mmcv build is needed. Input: (n, t, 3, h, w) RGB in [0, 1]; output: (n, t, 3, 4h, 4w).
run `python basicvsrpp.py` for the load + shape self-check."""
import os, torch
from torch import nn
from torch.nn import functional as F
from torchvision.ops import deform_conv2d

# weights stay out of git; download from https://download.openmmlab.com/mmediting/restorers/basicvsr_plusplus/ (same filename)
WEIGHTS = os.path.join(os.environ.get("UPSCALE_WEIGHTS", r"C:\Users\Admin\upscale\weights"),
                       "basicvsr_plusplus_c64n7_8x1_600k_reds4_20210217-db622b2f.pth")


def flow_warp(x, flow, padding_mode="zeros"):
    """warp x (n,c,h,w) by flow (n,h,w,2) in pixels"""
    n, _, h, w = x.shape
    gy, gx = torch.meshgrid(torch.arange(h, device=x.device), torch.arange(w, device=x.device), indexing="ij")
    g = torch.stack((gx, gy), 2).type_as(x) + flow
    g = torch.stack((2 * g[..., 0] / max(w - 1, 1) - 1, 2 * g[..., 1] / max(h - 1, 1) - 1), 3)
    return F.grid_sample(x, g, mode="bilinear", padding_mode=padding_mode, align_corners=True)


class ResidualBlockNoBN(nn.Module):
    def __init__(self, c):
        super().__init__(); self.conv1 = nn.Conv2d(c, c, 3, 1, 1); self.conv2 = nn.Conv2d(c, c, 3, 1, 1)

    def forward(self, x):
        return x + self.conv2(F.relu(self.conv1(x)))


class ResidualBlocksWithInputConv(nn.Module):
    def __init__(self, cin, c, n):
        super().__init__()
        self.main = nn.Sequential(nn.Conv2d(cin, c, 3, 1, 1), nn.LeakyReLU(0.1), nn.Sequential(*[ResidualBlockNoBN(c) for _ in range(n)]))

    def forward(self, x):
        return self.main(x)


class ConvModule(nn.Module):
    def __init__(self, cin, cout, act=True):
        super().__init__(); self.conv = nn.Conv2d(cin, cout, 7, 1, 3); self.act = act

    def forward(self, x):
        x = self.conv(x); return F.relu(x) if self.act else x


class SPyNetBasicModule(nn.Module):
    def __init__(self):
        super().__init__()
        self.basic_module = nn.Sequential(ConvModule(8, 32), ConvModule(32, 64), ConvModule(64, 32), ConvModule(32, 16), ConvModule(16, 2, act=False))

    def forward(self, x):
        return self.basic_module(x)


class SPyNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.basic_module = nn.ModuleList([SPyNetBasicModule() for _ in range(6)])
        self.register_buffer("mean", torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1))

    def compute_flow(self, ref, supp):
        n, _, h, w = ref.shape
        ref, supp = [(ref - self.mean) / self.std], [(supp - self.mean) / self.std]
        for _ in range(5):
            ref.append(F.avg_pool2d(ref[-1], 2, 2, count_include_pad=False))
            supp.append(F.avg_pool2d(supp[-1], 2, 2, count_include_pad=False))
        ref, supp = ref[::-1], supp[::-1]
        flow = ref[0].new_zeros(n, 2, h // 32, w // 32)
        for lv in range(len(ref)):
            up = flow if lv == 0 else F.interpolate(flow, scale_factor=2, mode="bilinear", align_corners=True) * 2.0
            flow = up + self.basic_module[lv](torch.cat([ref[lv], flow_warp(supp[lv], up.permute(0, 2, 3, 1), "border"), up], 1))
        return flow

    def forward(self, ref, supp):
        h, w = ref.shape[2:]; hu, wu = -(-h // 32) * 32, -(-w // 32) * 32
        ref = F.interpolate(ref, size=(hu, wu), mode="bilinear", align_corners=False)
        supp = F.interpolate(supp, size=(hu, wu), mode="bilinear", align_corners=False)
        flow = F.interpolate(self.compute_flow(ref, supp), size=(h, w), mode="bilinear", align_corners=False)
        flow[:, 0] *= w / wu; flow[:, 1] *= h / hu
        return flow


class SecondOrderDeformableAlignment(nn.Module):
    def __init__(self, cin, c, groups=16, max_mag=10):
        super().__init__()
        self.weight = nn.Parameter(torch.zeros(c, cin, 3, 3)); self.bias = nn.Parameter(torch.zeros(c))
        self.conv_offset = nn.Sequential(nn.Conv2d(3 * c + 4, c, 3, 1, 1), nn.LeakyReLU(0.1), nn.Conv2d(c, c, 3, 1, 1), nn.LeakyReLU(0.1),
                                         nn.Conv2d(c, c, 3, 1, 1), nn.LeakyReLU(0.1), nn.Conv2d(c, 27 * groups, 3, 1, 1))
        self.max_mag = max_mag

    def forward(self, x, extra, flow_1, flow_2):
        o1, o2, mask = torch.chunk(self.conv_offset(torch.cat([extra, flow_1, flow_2], 1)), 3, 1)
        off = self.max_mag * torch.tanh(torch.cat((o1, o2), 1))
        off1, off2 = torch.chunk(off, 2, 1)
        off1 = off1 + flow_1.flip(1).repeat(1, off1.size(1) // 2, 1, 1)
        off2 = off2 + flow_2.flip(1).repeat(1, off2.size(1) // 2, 1, 1)
        return deform_conv2d(x, torch.cat([off1, off2], 1), self.weight, self.bias, padding=1, mask=torch.sigmoid(mask))


class BasicVSRPlusPlus(nn.Module):
    MODULES = ["backward_1", "forward_1", "backward_2", "forward_2"]

    def __init__(self, c=64, n=7):
        super().__init__()
        self.c = c
        self.spynet = SPyNet()
        self.feat_extract = ResidualBlocksWithInputConv(3, c, 5)
        self.deform_align = nn.ModuleDict({m: SecondOrderDeformableAlignment(2 * c, c) for m in self.MODULES})
        self.backbone = nn.ModuleDict({m: ResidualBlocksWithInputConv((2 + i) * c, c, n) for i, m in enumerate(self.MODULES)})
        self.reconstruction = ResidualBlocksWithInputConv(5 * c, c, 5)
        self.upsample1 = PixelShufflePack(c); self.upsample2 = PixelShufflePack(c)
        self.conv_hr = nn.Conv2d(c, c, 3, 1, 1); self.conv_last = nn.Conv2d(c, 3, 3, 1, 1)

    def propagate(self, feats, flows, name):
        t = flows.size(1)
        frame_idx = list(range(t + 1)); flow_idx = list(range(-1, t))
        if name.startswith("backward"):
            frame_idx = frame_idx[::-1]; flow_idx = frame_idx
        prop = flows.new_zeros(flows.size(0), self.c, *flows.shape[3:])
        for i, idx in enumerate(frame_idx):
            cur = feats["spatial"][idx]
            if i > 0:
                f1 = flows[:, flow_idx[i]]
                c1 = flow_warp(prop, f1.permute(0, 2, 3, 1))
                n2, f2, c2 = torch.zeros_like(prop), torch.zeros_like(f1), torch.zeros_like(c1)
                if i > 1:
                    n2 = feats[name][-2]
                    f2 = flows[:, flow_idx[i - 1]]
                    f2 = f1 + flow_warp(f2, f1.permute(0, 2, 3, 1))
                    c2 = flow_warp(n2, f2.permute(0, 2, 3, 1))
                prop = self.deform_align[name](torch.cat([prop, n2], 1), torch.cat([c1, cur, c2], 1), f1, f2)
            feat = torch.cat([cur] + [feats[k][idx] for k in feats if k not in ("spatial", name)] + [prop], 1)
            prop = prop + self.backbone[name](feat)
            feats[name].append(prop)
        if name.startswith("backward"):
            feats[name] = feats[name][::-1]
        return feats

    def upsample(self, x, rows=256, pad=4):
        """4x head in horizontal strips: its 4 convs see < pad LR rows, so strips are exact and peak memory drops ~4x"""
        out = []
        for y in range(0, x.shape[2], rows):
            a, b = max(0, y - pad), min(x.shape[2], y + rows + pad)
            s = F.leaky_relu(self.upsample1(x[:, :, a:b]), 0.1)
            s = F.leaky_relu(self.upsample2(s), 0.1)
            s = self.conv_last(F.leaky_relu(self.conv_hr(s), 0.1))
            out.append(s[:, :, 4 * (y - a):4 * (y - a + min(rows, x.shape[2] - y))])
        return torch.cat(out, 2)

    def forward(self, lqs, post=None):
        """post: applied to each 4x frame as it is made (e.g. downscale), so the full-size stack is never held"""
        n, t, c, h, w = lqs.shape
        f = self.feat_extract(lqs.view(-1, c, h, w)).view(n, t, -1, h, w)
        feats = {"spatial": [f[:, i] for i in range(t)]}
        a, b = lqs[:, :-1].reshape(-1, c, h, w), lqs[:, 1:].reshape(-1, c, h, w)
        flows = {"backward": self.spynet(a, b).view(n, t - 1, 2, h, w), "forward": self.spynet(b, a).view(n, t - 1, 2, h, w)}
        for m in self.MODULES:
            feats[m] = []
            feats = self.propagate(feats, flows[m.split("_")[0]], m)
        out = []
        for i in range(t):
            hr = self.upsample(self.reconstruction(torch.cat([feats["spatial"][i]] + [feats[m][i] for m in self.MODULES], 1)))
            hr = hr + F.interpolate(lqs[:, i], scale_factor=4, mode="bilinear", align_corners=False)
            out.append(post(hr) if post else hr)
        return torch.stack(out, 1)


class PixelShufflePack(nn.Module):
    def __init__(self, c, scale=2):
        super().__init__(); self.upsample_conv = nn.Conv2d(c, c * scale * scale, 3, 1, 1); self.scale = scale

    def forward(self, x):
        return F.pixel_shuffle(self.upsample_conv(x), self.scale)


def load(device="cuda"):
    sd = torch.load(WEIGHTS, map_location="cpu", weights_only=True)
    sd = {k[len("generator."):]: v for k, v in sd["state_dict"].items() if k.startswith("generator.")}
    m = BasicVSRPlusPlus(); m.load_state_dict(sd, strict=True)
    return m.eval().to(device)


if __name__ == "__main__":
    m = load()
    with torch.no_grad():
        x = torch.rand(1, 5, 3, 64, 96, device="cuda")
        y = m(x)
    assert y.shape == (1, 5, 3, 256, 384), y.shape
    # a static clip must stay close to its bilinear upscale (catches a broken flow / offset layout)
    with torch.no_grad():
        s = torch.rand(1, 1, 3, 64, 96, device="cuda").repeat(1, 5, 1, 1, 1); s = F.avg_pool2d(s.view(-1, 3, 64, 96), 3, 1, 1).view(1, 5, 3, 64, 96)
        d = (m(s) - F.interpolate(s[0], scale_factor=4, mode="bilinear").unsqueeze(0)).abs().mean().item()
    assert d < 0.05, d
    print("ok: strict load, shape", tuple(y.shape), "static-clip residual", round(d, 4))
