import numpy as np
import os
import sys

# Ensure imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.manifolds import mobius_mapping, cylinder_mapping
from core.flow import flow_field
from core.flows_3d import hopf_fibration_flow, dna_vortex_flow
from core.klein_bottle import klein_bottle_mapping
from core.integration import integrate_trajectory
from analysis.signatures import extract_signatures
from analysis.signatures_3d import extract_signatures_3d
from analysis.signatures_klein import extract_signatures_klein
from plot.interactive import create_interactive_plot, create_animated_simulation
from analysis.exporter import export_results_to_json

def generate_web_bundle():
    print("🚀 Initializing SeamAware™ Asset Generation...")
    dist_dir = 'web_assets'
    os.makedirs(dist_dir, exist_ok=True)
    os.makedirs(f"{dist_dir}/3d", exist_ok=True)
    os.makedirs(f"{dist_dir}/klein", exist_ok=True)
    os.makedirs(f"{dist_dir}/simulations", exist_ok=True)
    os.makedirs(f"{dist_dir}/data", exist_ok=True)

    t_span = (0, 8 * np.pi)
    y0_2d = [0.0, 0.2]
    drift = 'sinusoidal'

    # 1. Möbius
    print("Generating Möbius Assets...")
    sol_mob = integrate_trajectory(flow_field, y0_2d, t_span, args=(drift,))
    res_mob = extract_signatures(sol_mob, mobius_mapping)
    create_interactive_plot(res_mob, mobius_mapping, "Möbius Interactive", f"{dist_dir}/mobius_3d.html")
    create_animated_simulation(res_mob, mobius_mapping, "Möbius Particle Drift", f"{dist_dir}/simulations/mobius_sim.html")
    export_results_to_json(res_mob, f"{dist_dir}/data/mobius_data.json")

    # 2. Cylinder
    print("Generating Cylinder Assets...")
    sol_cyl = integrate_trajectory(flow_field, y0_2d, t_span, args=(drift,))
    res_cyl = extract_signatures(sol_cyl, cylinder_mapping)
    create_interactive_plot(res_cyl, cylinder_mapping, "Cylinder Interactive", f"{dist_dir}/cylinder_3d.html")
    export_results_to_json(res_cyl, f"{dist_dir}/data/cylinder_data.json")

    # 3. Hopf Flow
    print("Generating Hopf Assets...")
    y0_3d = [1.0, 0.0, 0.0]
    sol_hopf = integrate_trajectory(hopf_fibration_flow, y0_3d, (0, 10.0))
    res_hopf = extract_signatures_3d(sol_hopf, hopf_fibration_flow)
    create_interactive_plot(res_hopf, title="Hopf Fibration Interactive", save_path=f"{dist_dir}/3d/hopf_3d.html", limit_frames_to_loop=True)
    create_animated_simulation(res_hopf, title="Hopf Fibration Live Flow", save_path=f"{dist_dir}/simulations/hopf_sim.html")
    export_results_to_json(res_hopf, f"{dist_dir}/data/hopf_data.json")

    # 4. Klein Bottle
    print("Generating Klein Interactive...")
    sol_klein = integrate_trajectory(flow_field, [0.0, 1.0], (0, 8 * np.pi), args=(drift,))
    res_klein = extract_signatures_klein(sol_klein)
    res_viz = {
        't': res_klein['t'],
        'positions': res_klein['coords_3d'].T,
        'frames': res_klein['frames']
    }
    create_interactive_plot(res_viz, title="Klein Bottle Interactive", save_path=f"{dist_dir}/klein/klein_3d.html", limit_frames_to_loop=True)

    print(f"\n✅ All SeamAware™ raw assets generated.")
    
    # --- PHASE 2: PREMIUM INLINING (Three.js) ---
    print("\n💎 Building Premium Three.js Bundle (Inlined Data)...")
    
    def create_premium_bundle(json_path, template_path, output_path, title_sub):
        with open(json_path, 'r', encoding='utf-8') as f:
            sim_json = f.read()
        
        with open(template_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
            
        # Inject data before the main script or at top of body
        inlined_script = f"<script>window.SIM_DATA = {sim_json};</script>\n"
        inlined_html = html_content.replace('<head>', f'<head>\n    {inlined_script}')
        inlined_html = inlined_html.replace('Premium Three.js Rendering Prototype', title_sub)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(inlined_html)
        print(f"   Created Premium Page: {output_path}")

    # Create Möbius Premium
    create_premium_bundle(
        f"{dist_dir}/data/mobius_data.json", 
        'threejs_prototype.html', 
        f"{dist_dir}/threejs_premium.html",
        "Möbius Premium Renderer"
    )

    print("\n✨ SeamAware™ Deployment Bundle Complete.")

if __name__ == "__main__":
    generate_web_bundle()
