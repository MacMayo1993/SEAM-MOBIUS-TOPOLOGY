import numpy as np
import os
from core.flow import flow_field
from core.integration import integrate_trajectory
from core.klein_bottle import klein_bottle_mapping
from analysis.signatures_klein import extract_signatures_klein
from plot.visualize import plot_topological_results

# We need to adapt plot_topological_results or use 3D
from plot.visualize_3d import plot_topological_results_3d

def explore_klein():
    os.makedirs('results/klein', exist_ok=True)

    print("--- Exploring Klein Bottle Flow ---")
    # Integration in (u, v) space
    t_max = 8 * np.pi
    y0 = [0.0, 1.0] # start off-center
    drift = 'sinusoidal'
    
    sol = integrate_trajectory(flow_field, y0, (0, t_max), args=(drift,))
    res = extract_signatures_klein(sol)
    
    # Adapt to 3D visualizer requirements
    res_viz = {
        't': res['t'],
        'positions': res['coords_3d'].T,
        'frames': res['frames']
    }
    
    plot_topological_results_3d(res_viz, "Klein Bottle (Figure-8 Immersion)", "results/klein/klein_flow.png")
    
    # Plot parity
    import matplotlib.pyplot as plt
    plt.figure(figsize=(10, 4))
    plt.step(res['t']/np.pi, res['w1'], where='post', color='purple', lw=2)
    plt.title("Klein Bottle Orientation Parity w1")
    plt.xlabel(r"Time ($\pi$ units)")
    plt.ylabel("Parity")
    plt.ylim(-0.1, 1.1)
    plt.grid(True)
    plt.savefig("results/klein/klein_signatures.png")
    print("Klein signatures Plot saved to results/klein/klein_signatures.png")

if __name__ == "__main__":
    explore_klein()
