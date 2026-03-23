"""
GLB Modifier CLI - Modifica file .glb da terminale.

Uso:
    python glb_modifier.py input.glb --info
    python glb_modifier.py input.glb --scale 2.0
    python glb_modifier.py input.glb --rotate 90 0 0
    python glb_modifier.py input.glb --translate 1 0 0
    python glb_modifier.py input.glb --color "#ff0000"
    python glb_modifier.py input.glb --metalness 0.8 --roughness 0.2
    python glb_modifier.py input.glb --center --smooth
    python glb_modifier.py input.glb --merge-meshes
    python glb_modifier.py input.glb -o output.glb --scale 1.5 --color "#3366ff" --center
"""

import argparse
import sys
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual import ColorVisuals


def load_glb(path: str) -> trimesh.Scene:
    """Carica un file GLB/GLTF."""
    result = trimesh.load(path)
    if isinstance(result, trimesh.Trimesh):
        scene = trimesh.Scene()
        scene.add_geometry(result, node_name="mesh_0")
        return scene
    if not isinstance(result, trimesh.Scene):
        raise ValueError(f"Tipo non supportato: {type(result)}")
    return result


def get_meshes(scene: trimesh.Scene) -> list:
    """Restituisce tutte le mesh dalla scena."""
    meshes = []
    for name, geom in scene.geometry.items():
        if isinstance(geom, trimesh.Trimesh):
            meshes.append((name, geom))
    return meshes


def print_info(scene: trimesh.Scene, path: str):
    """Stampa informazioni dettagliate sul modello."""
    print(f"\n{'='*50}")
    print(f"  File: {path}")
    print(f"  Dimensione: {Path(path).stat().st_size / 1024:.1f} KB")
    print(f"{'='*50}")

    meshes = get_meshes(scene)
    total_verts = 0
    total_faces = 0

    for name, mesh in meshes:
        verts = len(mesh.vertices)
        faces = len(mesh.faces)
        total_verts += verts
        total_faces += faces
        bbox = mesh.bounding_box.extents
        print(f"\n  Mesh: {name}")
        print(f"    Vertici:      {verts:,}")
        print(f"    Facce:        {faces:,}")
        print(f"    Bounding box: {bbox[0]:.3f} x {bbox[1]:.3f} x {bbox[2]:.3f}")
        print(f"    Centroide:    ({mesh.centroid[0]:.3f}, {mesh.centroid[1]:.3f}, {mesh.centroid[2]:.3f})")
        if mesh.is_watertight:
            print(f"    Volume:       {mesh.volume:.4f}")
        print(f"    Watertight:   {mesh.is_watertight}")

    print(f"\n  Totale: {total_verts:,} vertici, {total_faces:,} facce")
    print(f"  Mesh nella scena: {len(meshes)}")

    bounds = scene.bounds
    if bounds is not None:
        size = bounds[1] - bounds[0]
        print(f"  Dimensioni scena: {size[0]:.3f} x {size[1]:.3f} x {size[2]:.3f}")
    print()


def apply_scale(scene: trimesh.Scene, factor: float):
    """Scala uniforme."""
    for _, mesh in get_meshes(scene):
        mesh.apply_scale(factor)
    print(f"  Scala applicata: {factor}x")


def apply_scale_xyz(scene: trimesh.Scene, sx: float, sy: float, sz: float):
    """Scala non-uniforme."""
    matrix = np.diag([sx, sy, sz, 1.0])
    for _, mesh in get_meshes(scene):
        mesh.apply_transform(matrix)
    print(f"  Scala applicata: X={sx}, Y={sy}, Z={sz}")


def apply_rotate(scene: trimesh.Scene, rx: float, ry: float, rz: float):
    """Ruota il modello (gradi) attorno agli assi X, Y, Z."""
    rx_rad = np.radians(rx)
    ry_rad = np.radians(ry)
    rz_rad = np.radians(rz)

    rot_x = trimesh.transformations.rotation_matrix(rx_rad, [1, 0, 0])
    rot_y = trimesh.transformations.rotation_matrix(ry_rad, [0, 1, 0])
    rot_z = trimesh.transformations.rotation_matrix(rz_rad, [0, 0, 1])

    combined = rot_z @ rot_y @ rot_x
    for _, mesh in get_meshes(scene):
        mesh.apply_transform(combined)
    print(f"  Rotazione applicata: X={rx}, Y={ry}, Z={rz}")


def apply_translate(scene: trimesh.Scene, tx: float, ty: float, tz: float):
    """Trasla il modello."""
    for _, mesh in get_meshes(scene):
        mesh.apply_translation([tx, ty, tz])
    print(f"  Traslazione applicata: ({tx}, {ty}, {tz})")


def apply_center(scene: trimesh.Scene):
    """Centra il modello nell'origine."""
    for _, mesh in get_meshes(scene):
        mesh.apply_translation(-mesh.centroid)
    print("  Modello centrato nell'origine")


def apply_color(scene: trimesh.Scene, color_hex: str):
    """Applica un colore a tutte le mesh."""
    color_hex = color_hex.lstrip('#')
    r = int(color_hex[0:2], 16)
    g = int(color_hex[2:4], 16)
    b = int(color_hex[4:6], 16)
    a = 255

    for _, mesh in get_meshes(scene):
        mesh.visual = ColorVisuals(
            mesh=mesh,
            face_colors=np.tile([r, g, b, a], (len(mesh.faces), 1)),
        )
    print(f"  Colore applicato: #{color_hex} (R={r}, G={g}, B={b})")


def apply_smooth(scene: trimesh.Scene):
    """Applica smooth normals."""
    for _, mesh in get_meshes(scene):
        try:
            _ = mesh.vertex_normals
        except Exception:
            pass
    print("  Smooth normals applicati")


def apply_flip_normals(scene: trimesh.Scene):
    """Inverte le normali."""
    for _, mesh in get_meshes(scene):
        mesh.invert()
    print("  Normali invertite")


def merge_meshes(scene: trimesh.Scene) -> trimesh.Scene:
    """Unisce tutte le mesh in una sola."""
    meshes = [m for _, m in get_meshes(scene)]
    if len(meshes) <= 1:
        print("  Solo una mesh presente, niente da unire")
        return scene
    combined = trimesh.util.concatenate(meshes)
    new_scene = trimesh.Scene()
    new_scene.add_geometry(combined, node_name="merged")
    print(f"  {len(meshes)} mesh unite in una sola")
    return new_scene


def apply_subdivide(scene: trimesh.Scene):
    """Suddivide ogni faccia in 4."""
    for name, mesh in get_meshes(scene):
        result = trimesh.remesh.subdivide(mesh.vertices, mesh.faces)
        mesh.vertices = result[0]
        mesh.faces = result[1]
        print(f"  Suddivisione applicata a {name}: {len(result[1])} facce")


def export_glb(scene: trimesh.Scene, output_path: str):
    """Esporta la scena come GLB."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    glb_data: bytes = scene.export(file_type="glb")  # type: ignore[assignment]
    with open(output_path, "wb") as f:
        f.write(glb_data)
    size_kb = Path(output_path).stat().st_size / 1024
    print(f"\n  GLB esportato: {output_path} ({size_kb:.1f} KB)")


def main():
    parser = argparse.ArgumentParser(
        description="GLB Modifier - Modifica file .glb da terminale",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Esempi:
  python glb_modifier.py model.glb --info
  python glb_modifier.py model.glb --scale 2.0 -o model_big.glb
  python glb_modifier.py model.glb --rotate 90 0 0 --center --color "#ff3366"
  python glb_modifier.py model.glb --scale-xyz 1 2 1 --smooth
  python glb_modifier.py model.glb --merge-meshes --flip-normals
        """,
    )

    parser.add_argument("input", help="File GLB/GLTF di input")
    parser.add_argument("-o", "--output", help="File GLB di output (default: <input>_modified.glb)")
    parser.add_argument("--info", action="store_true", help="Mostra info sul modello")
    parser.add_argument("--scale", type=float, help="Scala uniforme")
    parser.add_argument("--scale-xyz", type=float, nargs=3, metavar=("X", "Y", "Z"), help="Scala non-uniforme")
    parser.add_argument("--rotate", type=float, nargs=3, metavar=("X", "Y", "Z"), help="Rotazione in gradi")
    parser.add_argument("--translate", type=float, nargs=3, metavar=("X", "Y", "Z"), help="Traslazione")
    parser.add_argument("--center", action="store_true", help="Centra il modello nell'origine")
    parser.add_argument("--color", type=str, help="Colore hex (es. #ff0000)")
    parser.add_argument("--smooth", action="store_true", help="Applica smooth normals")
    parser.add_argument("--flip-normals", action="store_true", help="Inverti le normali")
    parser.add_argument("--merge-meshes", action="store_true", help="Unisci tutte le mesh")
    parser.add_argument("--subdivide", action="store_true", help="Suddividi le facce")

    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Errore: file non trovato: {input_path}")
        sys.exit(1)

    print(f"\nCaricamento: {input_path}")
    scene = load_glb(str(input_path))

    if args.info:
        print_info(scene, str(input_path))
        if not any([args.scale, args.scale_xyz, args.rotate, args.translate,
                    args.center, args.color, args.smooth, args.flip_normals,
                    args.merge_meshes, args.subdivide]):
            return

    print("\nApplicazione modifiche:")

    if args.merge_meshes:
        scene = merge_meshes(scene)
    if args.scale:
        apply_scale(scene, args.scale)
    if args.scale_xyz:
        apply_scale_xyz(scene, *args.scale_xyz)
    if args.rotate:
        apply_rotate(scene, *args.rotate)
    if args.translate:
        apply_translate(scene, *args.translate)
    if args.center:
        apply_center(scene)
    if args.color:
        apply_color(scene, args.color)
    if args.smooth:
        apply_smooth(scene)
    if args.flip_normals:
        apply_flip_normals(scene)
    if args.subdivide:
        apply_subdivide(scene)

    # Determina output path
    if args.output:
        output_path = args.output
    else:
        output_path = str(input_path.stem) + "_modified.glb"
        output_path = str(input_path.parent / output_path)

    export_glb(scene, output_path)
    print("  Apri il file in VSCode per visualizzarlo con 3D Viewer\n")


if __name__ == "__main__":
    main()
