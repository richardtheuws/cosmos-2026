"""
Sprint 7A — Stick-figure pose generator for Flux Control LoRA Canny

Generates 6 simple high-contrast stick figures on white-bg 1024x1024 PNGs.
These act as HARD pose-constraints for fal-ai/flux-control-lora-canny.

Pose-anatomy intentionally simplified:
  - Head: oval (Cosmo's pear-drop head)
  - Body: ellipse (kid-torso)
  - Arms: thick lines ending in BIG circles (suction-cup pads — non-negotiable)
  - Legs: thick lines, slightly bent
  - Antenna: thin line + small circle on top of head

The Canny preprocessor (preprocess_depth=True default — but we keep it ON
because Canny will extract edges from these clean shapes regardless).
Lines need to be THICK ENOUGH (~12-18px) so Canny picks them up cleanly.
"""
from __future__ import annotations
from pathlib import Path
from PIL import Image, ImageDraw

CANVAS = 1024
BG = (255, 255, 255)
INK = (0, 0, 0)
ARM_W = 14
LEG_W = 16
SUCTION_R = 38   # MUST be visibly larger than head — that's the signature trait
HEAD_W, HEAD_H = 130, 160
TORSO_W, TORSO_H = 130, 180
ANT_LEN = 70


def base_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    return img, ImageDraw.Draw(img)


def draw_head_and_antenna(d: ImageDraw.ImageDraw, cx: int, top_y: int, tilt: int = 0):
    """Pear-drop head + single antenna with bulb tip."""
    # Head bbox (slightly narrower at top, wider at bottom — mimics pear)
    hb = (cx - HEAD_W // 2, top_y, cx + HEAD_W // 2, top_y + HEAD_H)
    d.ellipse(hb, outline=INK, width=6)
    # Single black ink eye (Moebius)
    eye_x = cx + (10 if tilt >= 0 else -10)
    eye_y = top_y + HEAD_H // 2 - 5
    d.ellipse((eye_x - 8, eye_y - 8, eye_x + 8, eye_y + 8), fill=INK)
    # Antenna: thin line up + bulb
    ant_top_y = top_y - ANT_LEN
    d.line((cx, top_y + 8, cx + tilt // 2, ant_top_y + 6), fill=INK, width=4)
    d.ellipse((cx + tilt // 2 - 9, ant_top_y - 9, cx + tilt // 2 + 9, ant_top_y + 9), outline=INK, width=4)


def draw_torso(d: ImageDraw.ImageDraw, cx: int, top_y: int) -> tuple[int, int, int, int]:
    """Returns (shoulder_y, hip_y, left_shoulder_x, right_shoulder_x)."""
    tb = (cx - TORSO_W // 2, top_y, cx + TORSO_W // 2, top_y + TORSO_H)
    d.ellipse(tb, outline=INK, width=6)
    shoulder_y = top_y + 25
    hip_y = top_y + TORSO_H - 15
    return shoulder_y, hip_y, cx - TORSO_W // 2 + 12, cx + TORSO_W // 2 - 12


def draw_arm(d: ImageDraw.ImageDraw, sx: int, sy: int, ex: int, ey: int):
    """Thick line + suction-cup disc at end."""
    d.line((sx, sy, ex, ey), fill=INK, width=ARM_W)
    d.ellipse((ex - SUCTION_R, ey - SUCTION_R, ex + SUCTION_R, ey + SUCTION_R), fill=INK)


def draw_leg(d: ImageDraw.ImageDraw, hx: int, hy: int, kx: int, ky: int, fx: int, fy: int):
    """Thick segmented line — hip → knee → foot."""
    d.line((hx, hy, kx, ky), fill=INK, width=LEG_W)
    d.line((kx, ky, fx, fy), fill=INK, width=LEG_W)
    d.ellipse((fx - 16, fy - 8, fx + 16, fy + 8), fill=INK)  # foot


# ---- POSES ----

def pose_walk_1() -> Image.Image:
    """Side-view, left leg forward, right leg back. Arms swinging opposite."""
    img, d = base_canvas()
    cx = CANVAS // 2
    head_top = 220
    draw_head_and_antenna(d, cx, head_top, tilt=10)
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    # Arms — left forward, right back
    draw_arm(d, ls, sy, ls - 100, sy + 220)   # left arm forward-down
    draw_arm(d, rs, sy, rs + 80, sy + 200)    # right arm back-down (slightly behind)
    # Legs — left forward bent, right back extended
    hipx_l, hipx_r = cx - 28, cx + 28
    draw_leg(d, hipx_l, hy, hipx_l - 50, hy + 110, hipx_l - 90, hy + 230)  # forward
    draw_leg(d, hipx_r, hy, hipx_r + 30, hy + 130, hipx_r + 70, hy + 240)  # back
    return img


def pose_walk_2() -> Image.Image:
    """Mirror of walk_1 — right leg forward, left leg back."""
    img, d = base_canvas()
    cx = CANVAS // 2
    head_top = 220
    draw_head_and_antenna(d, cx, head_top, tilt=-10)
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    draw_arm(d, ls, sy, ls - 80, sy + 200)
    draw_arm(d, rs, sy, rs + 100, sy + 220)
    hipx_l, hipx_r = cx - 28, cx + 28
    draw_leg(d, hipx_l, hy, hipx_l - 30, hy + 130, hipx_l - 70, hy + 240)
    draw_leg(d, hipx_r, hy, hipx_r + 50, hy + 110, hipx_r + 90, hy + 230)
    return img


def pose_jump_up() -> Image.Image:
    """Apex of jump — knees pulled up (tucked), arms up. Compact silhouette."""
    img, d = base_canvas()
    cx = CANVAS // 2
    head_top = 320
    draw_head_and_antenna(d, cx, head_top, tilt=0)
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    # Arms reaching up + slightly forward
    draw_arm(d, ls, sy, ls - 60, sy - 180)
    draw_arm(d, rs, sy, rs + 60, sy - 180)
    # Knees tucked UP-FORWARD (chibi-jump stance) — knee y < hip y
    hipx_l, hipx_r = cx - 28, cx + 28
    knee_y = hy + 30
    draw_leg(d, hipx_l, hy, hipx_l - 80, knee_y, hipx_l - 50, hy - 30)   # knee out, foot up
    draw_leg(d, hipx_r, hy, hipx_r + 80, knee_y, hipx_r + 50, hy - 30)
    return img


def pose_jump_fall() -> Image.Image:
    """Falling — arms spread out wide, legs slightly down/loose."""
    img, d = base_canvas()
    cx = CANVAS // 2
    head_top = 240
    draw_head_and_antenna(d, cx, head_top, tilt=0)
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    # Arms outstretched horizontal
    draw_arm(d, ls, sy, ls - 220, sy + 30)
    draw_arm(d, rs, sy, rs + 220, sy + 30)
    # Legs slightly apart, hanging
    hipx_l, hipx_r = cx - 28, cx + 28
    draw_leg(d, hipx_l, hy, hipx_l - 30, hy + 110, hipx_l - 50, hy + 230)
    draw_leg(d, hipx_r, hy, hipx_r + 30, hy + 110, hipx_r + 50, hy + 230)
    return img


def pose_cling_right() -> Image.Image:
    """Sideways body pressed against right-side wall.
       Both suction-cup hands reach RIGHT (toward wall), feet also touch wall.
       The character is rotated 90° conceptually — but for the sprite we render
       it in profile-with-hands-extended-right pose."""
    img, d = base_canvas()
    cx = CANVAS // 2 - 80
    head_top = 240
    draw_head_and_antenna(d, cx, head_top, tilt=20)  # antenna leans toward wall
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    # Both hands reach RIGHT (toward virtual wall) — suction cups stuck on wall
    draw_arm(d, rs, sy, rs + 220, sy - 40)            # upper hand on wall
    draw_arm(d, rs, sy + 60, rs + 220, sy + 60)       # lower hand on wall (from same shoulder area)
    # Legs slightly bent, feet also reaching toward wall
    hipx_l, hipx_r = cx - 28, cx + 28
    draw_leg(d, hipx_l, hy, hipx_l + 60, hy + 100, hipx_l + 130, hy + 180)
    draw_leg(d, hipx_r, hy, hipx_r + 60, hy + 110, hipx_r + 140, hy + 200)
    return img


def pose_hurt() -> Image.Image:
    """Knockback — head back, arms spread wide, body arched."""
    img, d = base_canvas()
    cx = CANVAS // 2
    head_top = 200
    # Head tilted back
    draw_head_and_antenna(d, cx, head_top, tilt=-30)
    sy, hy, ls, rs = draw_torso(d, cx, head_top + HEAD_H + 8)
    # Arms thrown out and back
    draw_arm(d, ls, sy, ls - 200, sy - 80)
    draw_arm(d, rs, sy, rs + 200, sy - 80)
    # Legs sprawled
    hipx_l, hipx_r = cx - 28, cx + 28
    draw_leg(d, hipx_l, hy, hipx_l - 70, hy + 120, hipx_l - 130, hy + 220)
    draw_leg(d, hipx_r, hy, hipx_r + 70, hy + 120, hipx_r + 130, hy + 220)
    return img


POSES = {
    'walk-1': pose_walk_1,
    'walk-2': pose_walk_2,
    'jump-up': pose_jump_up,
    'jump-fall': pose_jump_fall,
    'cling-right': pose_cling_right,
    'hurt': pose_hurt,
}


def main():
    out = Path('/Users/richardtheuws/Documents/games/cosmos-cosmic-adventure-2026/public/assets/case-study/cosmo-multi-frame/skeletons')
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in POSES.items():
        img = fn()
        path = out / f'skeleton-{name}.png'
        img.save(path)
        print(f'  wrote {path}')


if __name__ == '__main__':
    main()
