import numpy as np
import os
from core.flows_3d import hopf_fibration_flow, dna_vortex_flow
from core.integration import integrate_trajectory
from analysis.signatures_3d import extract_signatures_3d
from plot.visualize_3d import plot_topological_results_3d, plot_signatures_3d

def explore_3d_flows():
    os.makedirs('results/3d', exist_ok=True)

    print("--- Exploring Hopf Fibration Flow ---")
    # Start at a point in the torus
    y0_hopf = [1.0, 0.0, 0.0]
    t_max_hopf = 10.0
    sol_hopf = integrate_trajectory(hopf_fibration_flow, y0_hopf, (0, t_max_hopf))
    res_hopf = extract_signatures_3d(sol_hopf, hopf_fibration_flow)
    plot_topological_results_3d(res_hopf, "Hopf Fibration Flow", "results/3d/hopf_flow.png")
    plot_signatures_3d(res_hopf, "results/3d/hopf_signatures.png")

    print("\n--- Exploring DNA Vortex Flow ---")
    # Spiral around vertical axis
    y0_dna = [1.0, 0.0, 0.0]
    t_max_dna = 20.0
    sol_dna = integrate_trajectory(dna_vortex_flow, y0_dna, (0, t_max_dna), args=(1.0, 1.0))
    res_dna = extract_signatures_3d(sol_dna, dna_vortex_flow, args=(1.0, 1.0))
    plot_topological_results_3d(res_dna, "DNA Helix Vortex Flow", "results/3d/dna_vortex.png")
    plot_signatures_3d(res_dna, "results/3d/dna_signatures.png")

if __name__ == "__main__":
    explore_3d_flows()
