from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1200, 400
FPS = 12
DURATION = 5
TOTAL_FRAMES = int(FPS * DURATION)
FONT_DIR = "/System/Library/Fonts"

font_mono = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 20)
font_mono_sm = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 14)
font_mono_xs = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 11)
font_display = ImageFont.truetype(os.path.join(FONT_DIR, "SFNS.ttf"), 50)
font_title = ImageFont.truetype(os.path.join(FONT_DIR, "SFNS.ttf"), 17)

# High-contrast colors
GREEN = (140, 255, 50)
PURPLE = (190, 140, 255)
BLUE = (70, 190, 255)
YELLOW = (255, 220, 40)
WHITE = (255, 255, 255)
DIM = (160, 160, 160)
BG = (5, 5, 20)

def alpha_blend(bg, fg, alpha):
    return tuple(int(bg[i] * (1 - alpha) + fg[i] * alpha) for i in range(3))

def draw_c(draw, text, font, y, color, fade=1.0):
    b = draw.textbbox((0, 0), text, font=font)
    tw = b[2] - b[0]
    fc = tuple(int(c * fade) for c in color)
    draw.text(((W - tw) / 2 + 2, y + 2), text, font=font, fill=(0, 0, 0))
    draw.text(((W - tw) / 2, y), text, font=font, fill=fc)

def draw_x(draw, text, font, x, y, color, fade=1.0):
    b = draw.textbbox((0, 0), text, font=font)
    tw = b[2] - b[0]
    fc = tuple(int(c * fade) for c in color)
    draw.text((x - tw / 2 + 2, y + 2), text, font=font, fill=(0, 0, 0))
    draw.text((x - tw / 2, y), text, font=font, fill=fc)

def draw_x_bold(draw, text, font, x, y, color, fade=1.0):
    b = draw.textbbox((0, 0), text, font=font)
    tw = b[2] - b[0]
    fc = tuple(int(c * fade) for c in color)
    for dx, dy in [(-2, -2), (2, -2), (-2, 2), (2, 2)]:
        draw.text((x - tw / 2 + dx, y + dy), text, font=font, fill=(0, 0, 0))
    draw.text((x - tw / 2, y), text, font=font, fill=fc)

frames = []
for fi in range(TOTAL_FRAMES):
    t = fi / FPS
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    grid_intensity = 0.065 + 0.02 * math.sin(t * 1.2)
    gc = alpha_blend(BG, (120, 120, 160), grid_intensity)
    for x in range(0, W, 40):
        draw.line([(x, 0), (x, H)], fill=gc, width=1)
    for y in range(0, H, 40):
        draw.line([(0, y), (W, y)], fill=gc, width=1)

    glows = [
        (int(250 + 80 * math.sin(t * 0.7)), int(100 + 30 * math.cos(t * 0.5)), (140, 255, 50), 160),
        (int(950 + 80 * math.sin(t * 0.5 + 1)), int(300 + 30 * math.cos(t * 0.6)), (190, 140, 255), 130),
    ]
    for gx, gy, gc, max_r in glows:
        for r in range(max_r, 0, -25):
            a = 0.25 * (1 - r / max_r)
            c = alpha_blend(BG, gc, a)
            draw.ellipse([gx - r, gy - r, gx + r, gy + r], fill=c, outline=None)

    if t >= 0:
        a = min(1, t / 0.3)
        draw_c(draw, "COLD LOGIC ENGINE", font_mono, 72, WHITE, 0.3 * a)
    if t >= 0.3:
        a = min(1, (t - 0.3) / 0.3)
        draw_c(draw, "IELTS PEEL HACKER", font_display, 115, GREEN, a)

    blocks = [
        ("[P]", GREEN, 0.8, W // 2 - 210),
        ("[E1]", PURPLE, 1.5, W // 2 - 70),
        ("[E2]", BLUE, 1.9, W // 2 + 70),
        ("[L]", YELLOW, 2.3, W // 2 + 210),
    ]
    for label, color, start_t, x in blocks:
        if t >= start_t:
            a = min(1, (t - start_t) * 3)
            draw_x_bold(draw, label, font_mono, x, 203, color, a)

    arrows = [(1.0, W // 2 - 140), (1.6, W // 2), (2.05, W // 2 + 140)]
    for start_t, x in arrows:
        if t >= start_t:
            a = min(1, (t - start_t) * 3)
            ac = tuple(int(255 * 0.5 * a) for _ in range(3))
            draw.text((x - 6 + 2, 203), "\u2192", font=font_mono, fill=(0, 0, 0))
            draw.text((x - 6, 202), "\u2192", font=font_mono, fill=ac)

    if t >= 3.0:
        a = min(1, (t - 3.0) / 0.25)
        draw_c(draw, "Stop memorizing.  Start hacking.", font_title, 275, WHITE, 0.95 * a)
    if t >= 3.5:
        a = min(1, (t - 3.5) / 0.25)
        draw_c(draw, "IELTS rewards causal logic, not GRE vocabulary.", font_mono_sm, 305, WHITE, 0.55 * a)
    if t >= 4.0:
        a = min(1, (t - 4.0) / 0.25)
        draw_c(draw, "Agent Skill  \u00b7  System Prompt  \u00b7  Quality Gate", font_mono_xs, 355, WHITE, 0.18 * a)

    particles = [
        ("[CAUSAL]", 0.0, 0.05, 0.90),
        ("[CHAIN]", 1.5, 0.12, 0.82),
        ("[LOGIC]", 3.0, 0.85, 0.72),
        ("[PEEL]", 4.5, 0.90, 0.88),
        ("[CORE]", 2.0, 0.08, 0.78),
    ]
    for text, phase, px, py in particles:
        pt = (t + phase) % 8
        if pt < 6:
            a2 = max(0, 1 - abs(pt - 3) / 3)
            x2 = int(W * px)
            y2 = int(H * py - pt * 18)
            cc = tuple(int(255 * 0.15 * a2) for _ in range(3))
            draw.text((x2 + 1, y2 + 1), text, font=font_mono_xs, fill=(0, 0, 0))
            draw.text((x2, y2), text, font=font_mono_xs, fill=cc)

    if t >= 0.5:
        ab = min(1, (t - 0.5) / 0.4)
        credit = "by mixxmks"
        cb = draw.textbbox((0, 0), credit, font=font_mono_xs)
        cw = cb[2] - cb[0]
        cc = tuple(int(120 * ab) for _ in range(3))
        draw.text((W - cw - 18 + 1, H - 28 + 1), credit, font=font_mono_xs, fill=(0, 0, 0))
        draw.text((W - cw - 18, H - 28), credit, font=font_mono_xs, fill=cc)

    frames.append(img)

frames[0].save(
    "banner.gif",
    save_all=True,
    append_images=frames[1:],
    optimize=True,
    duration=1000 // FPS,
    loop=0,
)
print(f"banner.gif: {len(frames)} frames, {os.path.getsize('banner.gif')} bytes")
