from PIL import Image, ImageDraw, ImageFont
import os, math

W, H = 1200, 400
FPS = 12
DURATION = 6.5
TOTAL_FRAMES = int(FPS * DURATION)
FONT_DIR = "/System/Library/Fonts"

font_mono = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 20)
font_mono_sm = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 14)
font_mono_xs = ImageFont.truetype(os.path.join(FONT_DIR, "SFNSMono.ttf"), 11)
font_display = ImageFont.truetype(os.path.join(FONT_DIR, "SFNS.ttf"), 50)
font_title = ImageFont.truetype(os.path.join(FONT_DIR, "SFNS.ttf"), 17)

GREEN = (184, 245, 74)
PURPLE = (167, 123, 250)
BLUE = (96, 165, 250)
YELLOW = (251, 191, 36)
WHITE = (255, 255, 255)
DIM = (160, 160, 160)

def alpha_blend(bg, fg, alpha):
    return tuple(int(bg[i] * (1 - alpha) + fg[i] * alpha) for i in range(3))

def draw_c(draw, text, font, y, color, fade=1.0):
    b = draw.textbbox((0, 0), text, font=font)
    tw = b[2] - b[0]
    draw.text(((W - tw) / 2, y), text, font=font, fill=tuple(int(c * fade) for c in color))

def draw_x(draw, text, font, x, y, color, fade=1.0):
    b = draw.textbbox((0, 0), text, font=font)
    tw = b[2] - b[0]
    draw.text((x - tw / 2, y), text, font=font, fill=tuple(int(c * fade) for c in color))

def ease(t):
    return t * t * (3 - 2 * t)  # smoothstep

frames = []
for fi in range(TOTAL_FRAMES):
    t = fi / FPS
    img = Image.new("RGB", (W, H), (10, 10, 15))
    draw = ImageDraw.Draw(img)

    grid_a = int(6 * (0.8 + 0.2 * math.sin(t * 1.2)))
    for x in range(0, W, 40):
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, grid_a), width=1)
    for y in range(0, H, 40):
        draw.line([(0, y), (W, y)], fill=(255, 255, 255, grid_a), width=1)

    glows = [
        (int(250 + 80 * math.sin(t * 0.7)), int(100 + 30 * math.cos(t * 0.5)), GREEN),
        (int(950 + 80 * math.sin(t * 0.5 + 1)), int(300 + 30 * math.cos(t * 0.6)), PURPLE),
    ]
    for gx, gy, gc in glows:
        for r in range(180, 0, -10):
            a = int(10 * (1 - r / 180))
            draw.ellipse([gx - r, gy - r, gx + r, gy + r], outline=(0, 0, 0), width=0)

    if t >= 0:
        a = min(1, (t) / 0.3)
        draw_c(draw, "COLD LOGIC ENGINE", font_mono, 72, WHITE, 0.2 * a)
    if t >= 0.3:
        a = min(1, (t - 0.3) / 0.3)
        draw_c(draw, "IELTS PEEL HACKER", font_display, 115, GREEN, a)

    blocks = [
        ("[P]", GREEN, 0.8, W // 2 - 210),
        ("[E1]", PURPLE, 1.5, W // 2 - 70),
        ("[E2]", BLUE, 2.2, W // 2 + 70),
        ("[L]", YELLOW, 2.9, W // 2 + 210),
    ]
    for label, color, start_t, x in blocks:
        if t >= start_t:
            a = min(1, (t - start_t) * 3)
            draw_x(draw, label, font_mono, x, 203, color, a)

    arrows = [(1.1, W // 2 - 140), (1.8, W // 2), (2.5, W // 2 + 140)]
    for start_t, x in arrows:
        if t >= start_t:
            a = min(1, (t - start_t) * 3)
            draw.text((x - 6, 202), "→", font=font_mono, fill=tuple(int(255 * 0.2 * a) for _ in range(3)))

    if t >= 3.5:
        a = min(1, (t - 3.5) / 0.3)
        draw_c(draw, "Stop memorizing.  Start hacking.", font_title, 275, WHITE, 0.9 * a)
    if t >= 4:
        a = min(1, (t - 4) / 0.3)
        draw_c(draw, "IELTS rewards causal logic, not GRE vocabulary.", font_mono_sm, 305, WHITE, 0.4 * a)
    if t >= 4.5:
        a = min(1, (t - 4.5) / 0.3)
        draw_c(draw, "Agent Skill  ·  System Prompt  ·  Quality Gate", font_mono_xs, 355, WHITE, 0.12 * a)

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
            a = max(0, 1 - abs(pt - 3) / 3)
            x = int(W * px)
            y = int(H * py - pt * 18)
            draw.text((x, y), text, font=font_mono_xs, fill=tuple(int(255 * 0.08 * a) for _ in range(3)))

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
