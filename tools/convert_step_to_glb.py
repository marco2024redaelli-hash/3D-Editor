"""
Convert STEP files to GLB using CadQuery + trimesh.
Usage: python convert_step_to_glb.py --input "O:/EXPORT_PDM/STEP" --output "DATABASE1/exportPDMdaO" [--max 20]
"""
import os
import time
import argparse

def convert_step_to_glb(step_path, glb_path):
    """Convert a single STEP file to GLB."""
    import cadquery as cq
    import trimesh
    import tempfile

    try:
        # Import STEP with CadQuery
        result = cq.importers.importStep(step_path)

        # Export to temp STL using CadQuery's exporter
        tmp_stl = tempfile.mktemp(suffix='.stl')
        cq.exporters.export(result, tmp_stl, exportType='STL',
                            tolerance=0.1, angularTolerance=0.1)

        if not os.path.exists(tmp_stl) or os.path.getsize(tmp_stl) < 100:
            if os.path.exists(tmp_stl):
                os.remove(tmp_stl)
            return False

        # Load STL with trimesh and export as GLB
        mesh = trimesh.load(tmp_stl)
        os.remove(tmp_stl)

        if hasattr(mesh, 'is_empty') and mesh.is_empty:
            return False

        os.makedirs(os.path.dirname(glb_path), exist_ok=True)
        mesh.export(glb_path, file_type='glb')
        return os.path.exists(glb_path) and os.path.getsize(glb_path) > 200

    except Exception as e:
        raise e


def main():
    parser = argparse.ArgumentParser(description='Convert STEP files to GLB')
    parser.add_argument('--input', required=True, help='Input directory with STEP files')
    parser.add_argument('--output', required=True, help='Output directory for GLB files')
    parser.add_argument('--public', default='', help='Secondary output (public/db)')
    parser.add_argument('--max', type=int, default=0, help='Max files (0=all)')
    parser.add_argument('--skip-existing', action='store_true', default=True)
    parser.add_argument('--min-size', type=int, default=1024, help='Min STEP file size in bytes (skip tiny files)')
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input)
    output_dir = os.path.abspath(args.output)
    public_dir = os.path.abspath(args.public) if args.public else None

    # Collect STEP files
    print(f"Scanning {input_dir} for STEP files...")
    step_files = []
    for root, dirs, files in os.walk(input_dir):
        for f in sorted(files):
            if f.lower().endswith(('.step', '.stp')):
                full = os.path.join(root, f)
                if os.path.getsize(full) >= args.min_size:
                    step_files.append(full)

    print(f"Found {len(step_files)} STEP files (>= {args.min_size} bytes)")

    if args.max > 0:
        step_files = step_files[:args.max]
        print(f"Limiting to {args.max} files")

    converted = 0
    skipped = 0
    errors = 0
    start_time = time.time()

    for i, step_path in enumerate(step_files):
        rel_path = os.path.relpath(step_path, input_dir)
        glb_name = os.path.splitext(rel_path)[0] + '.glb'
        glb_path = os.path.join(output_dir, glb_name)

        elapsed = time.time() - start_time
        done = converted + errors + skipped
        if done > 0 and elapsed > 0:
            rate = done / elapsed
            remaining = (len(step_files) - i) / rate
            eta = f" ETA:{int(remaining)}s"
        else:
            eta = ""

        size_kb = os.path.getsize(step_path) / 1024
        print(f"[{i+1}/{len(step_files)}] {rel_path} ({size_kb:.0f}KB){eta}", end="", flush=True)

        if args.skip_existing and os.path.exists(glb_path) and os.path.getsize(glb_path) > 200:
            print(" SKIP")
            skipped += 1
            continue

        try:
            if convert_step_to_glb(step_path, glb_path):
                out_kb = os.path.getsize(glb_path) / 1024
                print(f" -> {out_kb:.0f}KB OK")
                converted += 1

                # Copy to public dir
                if public_dir:
                    pub_glb = os.path.join(public_dir, glb_name)
                    os.makedirs(os.path.dirname(pub_glb), exist_ok=True)
                    import shutil
                    shutil.copy2(glb_path, pub_glb)
            else:
                print(" FAIL (empty)")
                errors += 1
        except Exception as e:
            print(f" ERROR: {e}")
            errors += 1

    total_time = time.time() - start_time
    print(f"\n{'='*40}")
    print(f"CONVERSION COMPLETE")
    print(f"{'='*40}")
    print(f"Converted: {converted}")
    print(f"Skipped:   {skipped}")
    print(f"Errors:    {errors}")
    print(f"Time:      {total_time:.0f}s ({total_time/60:.1f}min)")
    print(f"Output:    {output_dir}")

if __name__ == "__main__":
    main()