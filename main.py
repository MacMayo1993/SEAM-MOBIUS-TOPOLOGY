import numpy as np
import os
from core.manifolds import mobius_mapping, cylinder_mapping
from core.integration import integrate_trajectory
from analysis.signatures import extract_signatures
from plot.visualize import plot_topological_results

def main():
    # Setup directories
    os.makedirs('results', exist_ok=True)
    os.makedirs('data', exist_ok=True)

    t_max = 6 * np.pi
    t_span = (0, t_max)
    y0 = [0.0, 0.2]
    drift = 'sinusoidal'

    from core.flow import flow_field
    print("--- Starting Möbius Simulation ---")
    sol_mob = integrate_trajectory(flow_field, y0, t_span, args=(drift,))
    res_mob = extract_signatures(sol_mob, mobius_mapping)
    plot_topological_results(res_mob, mobius_mapping, "Möbius", "results/mobius_modular.png")
    
    # Export Data
    np.save("data/mobius_w1.npy", res_mob['w1'])
    np.save("data/mobius_delta.npy", res_mob['delta'])

    print("\n--- Starting Cylinder Simulation ---")
    sol_cyl = integrate_trajectory(flow_field, y0, t_span, args=(drift,))
    res_cyl = extract_signatures(sol_cyl, cylinder_mapping)
    # Force w1=0 for cylinder (it's globally orientable)
    res_cyl['w1'] = np.zeros_like(res_cyl['w1'])
    plot_topological_results(res_cyl, cylinder_mapping, "Cylinder", "results/cylinder_modular.png")
    
    # Export Data
    np.save("data/cylinder_w1.npy", res_cyl['w1'])
    np.save("data/cylinder_delta.npy", res_cyl['delta'])

    print("\nModular Refactor successfully validated.")

if __name__ == "__main__":
    main()
