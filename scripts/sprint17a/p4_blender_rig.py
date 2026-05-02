"""
Sprint 17A — Track B step 2: Blender headless rig + 4 animation clips.

Usage (called from p4_run.sh):
  blender --background --python p4_blender_rig.py -- \
    --input <input.glb> --output <output.glb>

Bone hierarchy (matches cosmo-rig-spec.json conventions for 17B/E binding):
  bone_root         (hips, world driver)
   └─ bone_spine    (chest, body-lean parent)
       └─ bone_head (head rotation parent for eyes + antenne)
           ├─ bone_eye_l   (look-track left, weight to left eye-sphere)
           ├─ bone_eye_r   (look-track right, weight to right eye-sphere)
           └─ bone_antenne (antenne wiggle, single segment for simplicity)
       ├─ bone_arm_l
       │   └─ bone_disc_l (suction-cup wrist disc)
       └─ bone_arm_r
           └─ bone_disc_r

Total: 9 bones. Distance-based weight painting (proven on Meshy mesh
in `reign-of-brabant/scripts/blender-rig-and-animate.py` and
shared/reference_blender_pipeline.md).

Animation clips:
  - "idle"   — looped 4s (96 frames @ 24fps) — body breath-pulse + eye blink + slight antenne sway
  - "wave"   — one-shot 1.5s (36f) — bone_arm_r raised + slow eye-lock toward camera
  - "stretch" — one-shot 2s (48f) — both arms up + spine arched + head looking up
  - "sit"    — looped 6s (144f) — squat (root lowered) + spine forward + sniff twitch
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import mathutils

# ─── Args ───────────────────────────────────────────────────────────────────
def parse_args():
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        argv = []
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--specout', default=None,
                   help='Path to write rig-spec JSON (bone names + bounds)')
    return p.parse_args(argv)


# ─── Helpers ────────────────────────────────────────────────────────────────
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_glb(path: str) -> bpy.types.Object:
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise RuntimeError('No mesh after import')
    # Prefer the largest by vert-count (the body) if multiple primitives split
    meshes.sort(key=lambda o: -len(o.data.vertices))
    body = meshes[0]
    # Ensure body has identity transform (apply if non-identity)
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Merge any other tiny meshes (eye-discs etc.) into body so the armature
    # weights cover everything. Keep body as the merge target.
    for m in meshes[1:]:
        m.select_set(True)
    if len(meshes) > 1:
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
    return body


def mesh_bounds(obj: bpy.types.Object) -> dict:
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    zs = [v.z for v in verts]
    return {
        'xmin': min(xs), 'xmax': max(xs),
        'ymin': min(ys), 'ymax': max(ys),
        'zmin': min(zs), 'zmax': max(zs),
        'cx': (min(xs) + max(xs)) / 2,
        'cy': (min(ys) + max(ys)) / 2,
        'cz': (min(zs) + max(zs)) / 2,
        'height': max(zs) - min(zs),
        'width': max(xs) - min(xs),
    }


# ─── Build armature ─────────────────────────────────────────────────────────
def build_armature(body: bpy.types.Object, bounds: dict) -> bpy.types.Object:
    cx = bounds['cx']
    cy = bounds['cy']
    zmin = bounds['zmin']
    zmax = bounds['zmax']
    height = bounds['height']
    width = bounds['width']

    # Place bones along Z-axis (Blender default = +Z up)
    z_root = zmin + height * 0.10   # hips
    z_spine = zmin + height * 0.50  # chest
    z_neck = zmin + height * 0.72   # head base
    z_head = zmin + height * 0.92   # head tip
    z_eye = zmin + height * 0.85    # eye level

    # Arm zone — Cosmo has arms hanging from upper torso
    z_shoulder = zmin + height * 0.62
    z_wrist = zmin + height * 0.40
    x_shoulder = width * 0.18  # half-width offset for left/right

    bpy.ops.object.armature_add(enter_editmode=True, location=(cx, cy, z_root))
    arm_obj = bpy.context.active_object
    arm_obj.name = 'cosmo_armature'
    arm_data = arm_obj.data
    arm_data.name = 'cosmo_armature_data'

    # Default bone is named 'Bone'; rename + reposition to be bone_root
    edit_bones = arm_data.edit_bones
    default = edit_bones[0]
    default.name = 'bone_root'
    default.head = mathutils.Vector((cx, cy, z_root))
    default.tail = mathutils.Vector((cx, cy, z_spine))

    def add_bone(name: str, head, tail, parent_name: str | None = None):
        b = edit_bones.new(name)
        b.head = mathutils.Vector(head)
        b.tail = mathutils.Vector(tail)
        if parent_name:
            b.parent = edit_bones[parent_name]
            b.use_connect = False
        return b

    # spine, head, eyes, antenne
    add_bone('bone_spine', (cx, cy, z_spine), (cx, cy, z_neck), 'bone_root')
    add_bone('bone_head',  (cx, cy, z_neck),  (cx, cy, z_head), 'bone_spine')
    add_bone('bone_eye_l', (cx - width * 0.06, cy - 0.05, z_eye),
                          (cx - width * 0.06, cy - 0.10, z_eye), 'bone_head')
    add_bone('bone_eye_r', (cx + width * 0.06, cy - 0.05, z_eye),
                          (cx + width * 0.06, cy - 0.10, z_eye), 'bone_head')
    add_bone('bone_antenne', (cx, cy, z_head),
                            (cx, cy, z_head + height * 0.18), 'bone_head')

    # Arms: shoulder -> elbow -> wrist (single bone per arm, simplified)
    add_bone('bone_arm_l', (cx - x_shoulder, cy, z_shoulder),
                          (cx - x_shoulder * 1.4, cy, z_wrist), 'bone_spine')
    add_bone('bone_arm_r', (cx + x_shoulder, cy, z_shoulder),
                          (cx + x_shoulder * 1.4, cy, z_wrist), 'bone_spine')

    # Discs — small bones at wrist tip for independent wiggle
    add_bone('bone_disc_l', (cx - x_shoulder * 1.4, cy, z_wrist),
                          (cx - x_shoulder * 1.5, cy, z_wrist - height * 0.05),
                          'bone_arm_l')
    add_bone('bone_disc_r', (cx + x_shoulder * 1.4, cy, z_wrist),
                          (cx + x_shoulder * 1.5, cy, z_wrist - height * 0.05),
                          'bone_arm_r')

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj


# ─── Distance-based weight painting ─────────────────────────────────────────
def parent_with_weights(body: bpy.types.Object, arm_obj: bpy.types.Object,
                        bounds: dict) -> None:
    """Manual distance-based weight painting (no Bone Heat — fails on Meshy mesh).

    Strategy mirrors reign-of-brabant pipeline:
    - For each vertex, compute distance to each bone (head-to-tail line).
    - Pick top-2 closest bones, normalise weights = 1 / (1 + d²).
    - Apply head-zone-lock: vertices above 72% height ONLY get head/eye/antenne bones.
    - Disc-zone-lock: vertices in disc-region (wrist) get higher disc weight.
    """
    # First, normal parent without auto-weights
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    arm_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.parent_set(type='ARMATURE_NAME')  # creates vgroups, no weights

    # Now compute weights manually
    bone_segments: dict[str, tuple[mathutils.Vector, mathutils.Vector]] = {}
    arm_data = arm_obj.data
    for b in arm_data.bones:
        bone_segments[b.name] = (b.head_local.copy(), b.tail_local.copy())

    height = bounds['height']
    zmin = bounds['zmin']
    z_head_zone = zmin + height * 0.72   # above this: ONLY head/eye/antenne
    z_arm_zone_top = zmin + height * 0.62
    z_arm_zone_bot = zmin + height * 0.30

    HEAD_BONES = {'bone_head', 'bone_eye_l', 'bone_eye_r', 'bone_antenne'}
    LEFT_ARM_BONES = {'bone_arm_l', 'bone_disc_l'}
    RIGHT_ARM_BONES = {'bone_arm_r', 'bone_disc_r'}
    BODY_BONES = {'bone_root', 'bone_spine'}

    def dist_to_segment(p: mathutils.Vector, a: mathutils.Vector,
                        b: mathutils.Vector) -> float:
        ab = b - a
        ab_len2 = ab.length_squared
        if ab_len2 < 1e-9:
            return (p - a).length
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab_len2))
        return (p - (a + ab * t)).length

    # Ensure all bone vertex groups exist
    for name in bone_segments.keys():
        if name not in body.vertex_groups:
            body.vertex_groups.new(name=name)

    # Assign weights per vertex
    for vi, v in enumerate(body.data.vertices):
        co = body.matrix_world @ v.co
        # Determine zone & bone-set candidates
        if co.z >= z_head_zone:
            candidates = HEAD_BONES
        else:
            candidates = set(bone_segments.keys()) - HEAD_BONES
            # narrow: arms only if vertex is in arm-zone height band AND lateral
            if co.z >= z_arm_zone_bot and co.z <= z_arm_zone_top:
                pass  # both arm + body candidates allowed
            else:
                candidates -= LEFT_ARM_BONES | RIGHT_ARM_BONES

        # Compute distance to each candidate's segment
        dists = []
        for name in candidates:
            head, tail = bone_segments[name]
            d = dist_to_segment(co, head, tail)
            dists.append((d, name))
        if not dists:
            continue
        dists.sort()
        # Top-2 weighted (smooth blending)
        top = dists[:2]
        weights = []
        total = 0.0
        for d, _ in top:
            w = 1.0 / (1.0 + d * d * 4.0)  # SMOOTH_FACTOR ~ proven shape
            weights.append(w)
            total += w
        if total < 1e-6:
            # fall back: nearest-only weight 1.0
            body.vertex_groups[top[0][1]].add([vi], 1.0, 'REPLACE')
            continue
        for (d, name), w in zip(top, weights):
            body.vertex_groups[name].add([vi], w / total, 'REPLACE')


# ─── Animation clips ────────────────────────────────────────────────────────
def build_idle_clip(arm_obj: bpy.types.Object) -> bpy.types.Action:
    """Idle-breath: 96f @ 24fps = 4s loop. Body breath, eye blink, antenne sway."""
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    action = bpy.data.actions.new('idle')
    arm_obj.animation_data_create()
    arm_obj.animation_data.action = action

    pb = arm_obj.pose.bones
    L = 96
    # bone_spine breath: small Z-scale (1.00-1.04-1.00) and slight X-rot
    for f in [0, L // 2, L]:
        s = 1.00 if f != L // 2 else 1.04
        pb['bone_spine'].scale = (1.0, 1.0, s)
        pb['bone_spine'].keyframe_insert('scale', frame=f)
        pb['bone_spine'].rotation_mode = 'XYZ'
        pb['bone_spine'].rotation_euler = (math.radians(2.0 if f == L // 2 else 0), 0, 0)
        pb['bone_spine'].keyframe_insert('rotation_euler', frame=f)

    # Eye-blink: scale Z to 0.1 briefly (blink) at f=70 and f=72, otherwise 1.0
    for eye in ('bone_eye_l', 'bone_eye_r'):
        pb[eye].rotation_mode = 'XYZ'
        for f in [0, 68, 70, 72, L]:
            pb[eye].scale = (1.0, 1.0, 0.1 if f in (70,) else 1.0)
            pb[eye].keyframe_insert('scale', frame=f)

    # Antenne gentle sway: rotate X +/- 5° over the loop
    pb['bone_antenne'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (24, 4), (48, 0), (72, -4), (L, 0)]:
        pb['bone_antenne'].rotation_euler = (math.radians(deg), 0, 0)
        pb['bone_antenne'].keyframe_insert('rotation_euler', frame=f)

    bpy.ops.object.mode_set(mode='OBJECT')
    return action


def build_wave_clip(arm_obj: bpy.types.Object) -> bpy.types.Action:
    """Wave: 36f @ 24fps = 1.5s one-shot. Right arm raised + eye-lock."""
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    action = bpy.data.actions.new('wave')
    arm_obj.animation_data.action = action
    pb = arm_obj.pose.bones
    L = 36

    # Right arm: anticipate (f0-6) → raise (f6-18) → wave back (f18-30) → lower (f30-36)
    pb['bone_arm_r'].rotation_mode = 'XYZ'
    pb['bone_arm_r'].rotation_euler = (0, 0, 0)
    pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=0)
    pb['bone_arm_r'].rotation_euler = (math.radians(-30), 0, math.radians(70))
    pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=12)
    pb['bone_arm_r'].rotation_euler = (math.radians(-30), 0, math.radians(50))
    pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=24)
    pb['bone_arm_r'].rotation_euler = (math.radians(-30), 0, math.radians(70))
    pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=30)
    pb['bone_arm_r'].rotation_euler = (0, 0, 0)
    pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=L)

    # Disc R: small wiggle during wave
    pb['bone_disc_r'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (12, 12), (18, -10), (24, 12), (30, -10), (L, 0)]:
        pb['bone_disc_r'].rotation_euler = (math.radians(deg), 0, 0)
        pb['bone_disc_r'].keyframe_insert('rotation_euler', frame=f)

    # Head — slight tilt toward camera (Y-rot)
    pb['bone_head'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (8, -6), (28, -6), (L, 0)]:
        pb['bone_head'].rotation_euler = (0, math.radians(deg), 0)
        pb['bone_head'].keyframe_insert('rotation_euler', frame=f)

    bpy.ops.object.mode_set(mode='OBJECT')
    return action


def build_stretch_clip(arm_obj: bpy.types.Object) -> bpy.types.Action:
    """Stretch: 48f @ 24fps = 2s one-shot. Both arms up + spine arch."""
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    action = bpy.data.actions.new('stretch')
    arm_obj.animation_data.action = action
    pb = arm_obj.pose.bones
    L = 48

    # Both arms raise overhead (Y-rot)
    for arm, sign in [('bone_arm_l', +1), ('bone_arm_r', -1)]:
        pb[arm].rotation_mode = 'XYZ'
        pb[arm].rotation_euler = (0, 0, 0)
        pb[arm].keyframe_insert('rotation_euler', frame=0)
        pb[arm].rotation_euler = (math.radians(-130), 0, math.radians(sign * 20))
        pb[arm].keyframe_insert('rotation_euler', frame=24)
        pb[arm].rotation_euler = (math.radians(-130), 0, math.radians(sign * 20))
        pb[arm].keyframe_insert('rotation_euler', frame=36)
        pb[arm].rotation_euler = (0, 0, 0)
        pb[arm].keyframe_insert('rotation_euler', frame=L)

    # Spine arches back (X-rot negative)
    pb['bone_spine'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (24, -15), (36, -15), (L, 0)]:
        pb['bone_spine'].rotation_euler = (math.radians(deg), 0, 0)
        pb['bone_spine'].keyframe_insert('rotation_euler', frame=f)

    # Head looks up
    pb['bone_head'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (24, -25), (36, -25), (L, 0)]:
        pb['bone_head'].rotation_euler = (math.radians(deg), 0, 0)
        pb['bone_head'].keyframe_insert('rotation_euler', frame=f)

    bpy.ops.object.mode_set(mode='OBJECT')
    return action


def build_sit_clip(arm_obj: bpy.types.Object) -> bpy.types.Action:
    """Sit-sniff: 144f @ 24fps = 6s loop. Squat + lean + sniff twitch."""
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='POSE')
    action = bpy.data.actions.new('sit')
    arm_obj.animation_data.action = action
    pb = arm_obj.pose.bones
    L = 144

    # Root drops Z by ~30% (squat)
    pb['bone_root'].location = (0, 0, 0)
    pb['bone_root'].keyframe_insert('location', frame=0)
    pb['bone_root'].location = (0, 0, -0.20)
    pb['bone_root'].keyframe_insert('location', frame=24)
    pb['bone_root'].location = (0, 0, -0.20)
    pb['bone_root'].keyframe_insert('location', frame=120)
    pb['bone_root'].location = (0, 0, 0)
    pb['bone_root'].keyframe_insert('location', frame=L)

    # Spine forward lean (X-rot positive)
    pb['bone_spine'].rotation_mode = 'XYZ'
    for f, deg in [(0, 0), (24, 25), (120, 25), (L, 0)]:
        pb['bone_spine'].rotation_euler = (math.radians(deg), 0, 0)
        pb['bone_spine'].keyframe_insert('rotation_euler', frame=f)

    # Head sniff-twitch (small periodic +/-5° Y-rot)
    pb['bone_head'].rotation_mode = 'XYZ'
    twitches = [(36, 5), (40, -5), (44, 0),
                (72, 5), (76, -5), (80, 0),
                (108, 5), (112, -5), (116, 0)]
    pb['bone_head'].rotation_euler = (math.radians(20), 0, 0)
    pb['bone_head'].keyframe_insert('rotation_euler', frame=24)
    for f, deg in twitches:
        pb['bone_head'].rotation_euler = (math.radians(20), 0, math.radians(deg))
        pb['bone_head'].keyframe_insert('rotation_euler', frame=f)
    pb['bone_head'].rotation_euler = (math.radians(20), 0, 0)
    pb['bone_head'].keyframe_insert('rotation_euler', frame=120)
    pb['bone_head'].rotation_euler = (0, 0, 0)
    pb['bone_head'].keyframe_insert('rotation_euler', frame=L)

    # Right arm reaches forward+down
    pb['bone_arm_r'].rotation_mode = 'XYZ'
    for f, deg_x, deg_z in [(0, 0, 0), (30, 30, -20), (110, 30, -20), (L, 0, 0)]:
        pb['bone_arm_r'].rotation_euler = (math.radians(deg_x), 0, math.radians(deg_z))
        pb['bone_arm_r'].keyframe_insert('rotation_euler', frame=f)

    bpy.ops.object.mode_set(mode='OBJECT')
    return action


# ─── NLA tracks (so all 4 clips export as separate animations) ──────────────
def push_actions_to_nla(arm_obj, actions):
    """Push each action to its own NLA track so glTF exporter sees 4 anims."""
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    for action in actions:
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = action.name
        strip = track.strips.new(action.name, int(action.frame_range[0]), action)
        strip.name = action.name
    # Clear active action so nothing is "current"
    arm_obj.animation_data.action = None


# ─── Export GLB ─────────────────────────────────────────────────────────────
def export_glb(out_path: str):
    bpy.ops.object.select_all(action='SELECT')
    kwargs = dict(
        filepath=out_path,
        export_format='GLB',
        export_yup=True,
        export_animations=True,
        export_anim_single_armature=True,
        export_skins=True,
        export_morph=False,
        export_apply=False,
        export_nla_strips=True,
        export_force_sampling=True,
        export_frame_range=False,
        export_optimize_animation_size=True,
    )
    # Some Blender versions reject specific params; degrade gracefully.
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        for k in ('export_optimize_animation_size', 'export_anim_single_armature'):
            kwargs.pop(k, None)
        bpy.ops.export_scene.gltf(**kwargs)


# ─── Main ───────────────────────────────────────────────────────────────────
def main():
    args = parse_args()
    reset_scene()
    print(f'Importing {args.input}')
    body = import_glb(args.input)
    bounds = mesh_bounds(body)
    print(f'  body: {len(body.data.vertices)} verts, '
          f'h={bounds["height"]:.3f} w={bounds["width"]:.3f}')

    print('Building armature')
    arm_obj = build_armature(body, bounds)

    print('Parenting + distance-based weights')
    parent_with_weights(body, arm_obj, bounds)

    print('Building animation clips')
    actions = [
        build_idle_clip(arm_obj),
        build_wave_clip(arm_obj),
        build_stretch_clip(arm_obj),
        build_sit_clip(arm_obj),
    ]

    print('Pushing actions to NLA tracks')
    push_actions_to_nla(arm_obj, actions)

    print(f'Exporting {args.output}')
    export_glb(args.output)
    print('Export OK')

    if args.specout:
        spec = {
            'version': 'sprint17a',
            'mesh_bounds': bounds,
            'bones': {
                'bone_root':    {'role': 'world driver / hips, body lean'},
                'bone_spine':   {'role': 'chest pivot, body lean & breath'},
                'bone_head':    {'role': 'head yaw/pitch (camera follow)'},
                'bone_eye_l':   {'role': 'left eye look-track (Y-Z rot)'},
                'bone_eye_r':   {'role': 'right eye look-track (Y-Z rot)'},
                'bone_antenne': {'role': 'antenne wiggle (FFT air-band)'},
                'bone_arm_l':   {'role': 'left arm shoulder-elbow-wrist'},
                'bone_arm_r':   {'role': 'right arm shoulder-elbow-wrist'},
                'bone_disc_l':  {'role': 'left wrist suction-cup wiggle (FFT-low)'},
                'bone_disc_r':  {'role': 'right wrist suction-cup wiggle (FFT-low)'},
            },
            'clips': {
                'idle':    {'length_frames': 96,  'fps': 24, 'loop': True,  'duration_s': 4.0},
                'wave':    {'length_frames': 36,  'fps': 24, 'loop': False, 'duration_s': 1.5},
                'stretch': {'length_frames': 48,  'fps': 24, 'loop': False, 'duration_s': 2.0},
                'sit':     {'length_frames': 144, 'fps': 24, 'loop': True,  'duration_s': 6.0},
            },
            'binding_hints': {
                'head_yaw': 'bone_head Y-rot drives left/right look (camera/cursor)',
                'head_pitch': 'bone_head X-rot drives up/down look',
                'body_lean': 'bone_spine X-rot small lean on gyro tilt',
                'eye_track_independent': 'bone_eye_l/_r quaternion override (overrides idle blink)',
                'antenne_wiggle': 'bone_antenne X/Z rot from FFT air-band',
                'disc_bobble':   'bone_disc_l/_r small Y-rot from FFT low-band',
            },
        }
        Path(args.specout).write_text(json.dumps(spec, indent=2))
        print(f'Spec written to {args.specout}')


if __name__ == '__main__':
    main()
