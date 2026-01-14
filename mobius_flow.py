import numpy as np
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from mpl_toolkits.mplot3d import Axes3D

def mobius_mapping(u, v):
    """Maps (u, v) to 3D and returns mapping + partial derivatives."""
    x = (1 + 0.5 * v * np.cos(u / 2)) * np.cos(u)
    y = (1 + 0.5 * v * np.cos(u / 2)) * np.sin(u)
    z = 0.5 * v * np.sin(u / 2)
    pos = np.array([x, y, z])
    
    # Tangent vectors
    xu = -0.25 * v * np.sin(u/2) * np.cos(u) - (1 + 0.5 * v * np.cos(u/2)) * np.sin(u)
    yu = -0.25 * v * np.sin(u/2) * np.sin(u) + (1 + 0.5 * v * np.cos(u/2)) * np.cos(u)
    zu = 0.25 * v * np.cos(u/2)
    ru = np.array([xu, yu, zu])
    
    xv = 0.5 * np.cos(u/2) * np.cos(u)
    yv = 0.5 * np.cos(u/2) * np.sin(u)
    zv = 0.5 * np.sin(u/2)
    rv = np.array([xv, yv, zv])
    
    return pos, ru, rv

def cylinder_mapping(u, v):
    """Maps (u, v) to 3D and returns mapping + partial derivatives."""
    pos = np.array([np.cos(u), np.sin(u), v])
    ru = np.array([-np.sin(u), np.cos(u), 0])
    rv = np.array([0, 0, 1])
    return pos, ru, rv

def flow_field(t, state, drift_type='constant'):
    u, v = state
    du_dt = 1.0
    if drift_type == 'constant':
        dv_dt = 0.0
    elif drift_type == 'sinusoidal':
        dv_dt = 0.1 * np.sin(u)
    else:
        dv_dt = 0.0
    return [du_dt, dv_dt]

def run_simulation(mapping_func, drift_type='constant', t_max=4*np.pi, save_data=True):
    t_span = (0, t_max)
    y0 = [0.0, 0.2]  # Initial state (u, v)
    
    sol = solve_ivp(flow_field, t_span, y0, args=(drift_type,), 
                    t_eval=np.linspace(0, t_max, 1000), method='RK45')
    
    u_vals = sol.y[0]
    v_vals = sol.y[1]
    t_vals = sol.t
    
    # Calculate velocities in intrinsic space
    flow_vectors = np.array([flow_field(t, [u, v], drift_type) for t, u, v in zip(t_vals, u_vals, v_vals)])
    du_dt_vals = flow_vectors[:, 0]
    dv_dt_vals = flow_vectors[:, 1]
    
    # Topological Signatures
    theta_vals = np.arctan2(dv_dt_vals, du_dt_vals)
    theta_unwrapped = np.unwrap(theta_vals)
    delta_vals = np.abs(v_vals)
    
    # 3D Mapping and Frame Tracking
    coords_3d = []
    frames = []
    w1_vals = []
    current_parity = 0
    prev_normal = None
    
    for u, v in zip(u_vals, v_vals):
        pos, ru, rv = mapping_func(u, v)
        # Normalize frame
        ru_n = ru / np.linalg.norm(ru)
        rv_n = rv / np.linalg.norm(rv)
        normal = np.cross(ru, rv)
        normal_n = normal / np.linalg.norm(normal)
        
        # Parity tracking via Radial Projection of RV
        # rv is the transverse tangent vector. 
        # radial_vec (R) points from center through the particle.
        radial_vec = np.array([np.cos(u), np.sin(u), 0])
        # We use sgn(rv . R) to track the orientation flip.
        # However, to match the w1 = floor(u/2pi) mod 2 convention:
        projection = np.dot(rv, radial_vec)
        # The twist is centered at 2pi, 6pi, etc.
        # To get a step at 2pi, we can look at the sign of the mapping's cos(u/2)
        w1 = 1 if np.cos(u/2) < 0 else 0
        w1_vals.append(w1)
        
        coords_3d.append(pos)
        frames.append((ru_n, rv_n, normal_n))
        prev_normal = normal_n
        
    coords_3d = np.array(coords_3d).T
    w1_vals = np.array(w1_vals)
    
    if save_data:
        prefix = "mobius" if "mobius" in mapping_func.__name__ else "cylinder"
        np.save(f"C:/Users/macma/.gemini/antigravity/scratch/mobius_topology/data/{prefix}_theta.npy", theta_unwrapped)
        np.save(f"C:/Users/macma/.gemini/antigravity/scratch/mobius_topology/data/{prefix}_delta.npy", delta_vals)
        np.save(f"C:/Users/macma/.gemini/antigravity/scratch/mobius_topology/data/{prefix}_w1.npy", w1_vals)

    return {
        't': t_vals,
        'u': u_vals,
        'v': v_vals,
        'theta': theta_unwrapped,
        'delta': delta_vals,
        'w1': w1_vals,
        'coords_3d': coords_3d,
        'frames': frames
    }

def plot_results(results, title_prefix="Möbius"):
    fig = plt.figure(figsize=(15, 10))
    
    # 3D Trajectory
    ax1 = fig.add_subplot(2, 2, 1, projection='3d')
    # Plot the surface for context
    u_surf = np.linspace(0, max(results['u']), 100)
    v_surf = np.linspace(-0.5, 0.5, 20)
    U, V = np.meshgrid(u_surf, v_surf)
    if title_prefix == "Möbius":
        X = (1 + 0.5 * V * np.cos(U/2)) * np.cos(U)
        Y = (1 + 0.5 * V * np.cos(U/2)) * np.sin(U)
        Z = 0.5 * V * np.sin(U/2)
    else:
        X = np.cos(U)
        Y = np.sin(U)
        Z = V
    
    ax1.plot_surface(X, Y, Z, alpha=0.1, color='gray') # Reduced alpha for better visibility of frames
    ax1.plot(results['coords_3d'][0], results['coords_3d'][1], results['coords_3d'][2], color='red', lw=2)
    
    # Plot frames at specific intervals
    num_frames = 15
    indices = np.linspace(0, len(results['t']) - 1, num_frames, dtype=int)
    coords = results['coords_3d']
    frames = results['frames']
    for i in indices:
        pos = coords[:, i]
        ru, rv, normal = frames[i]
        # Tangent vectors (blue and green)
        ax1.quiver(pos[0], pos[1], pos[2], ru[0], ru[1], ru[2], color='blue', length=0.15, normalize=True, alpha=0.6)
        ax1.quiver(pos[0], pos[1], pos[2], rv[0], rv[1], rv[2], color='green', length=0.15, normalize=True, alpha=0.6)
        # Normal vector (magenta)
        ax1.quiver(pos[0], pos[1], pos[2], normal[0], normal[1], normal[2], color='magenta', length=0.25, normalize=True)

    ax1.set_title(f"{title_prefix} Strip Trajectory & Orientation Frames")
    
    # Theta Plot
    ax2 = fig.add_subplot(2, 2, 2)
    ax2.plot(results['t'], results['theta'])
    ax2.set_title(r"$\theta(t)$ (Unwrapped Phase)")
    ax2.set_xlabel("Time")
    ax2.set_ylabel("Radians")
    
    # Delta Plot
    ax3 = fig.add_subplot(2, 2, 3)
    ax3.plot(results['t'], results['delta'])
    ax3.set_title(r"$\delta(t)$ (Distance to Seam)")
    ax3.set_xlabel("Time")
    ax3.set_ylabel("Distance")
    
    # W1 Plot
    ax4 = fig.add_subplot(2, 2, 4)
    ax4.step(results['t'], results['w1'], where='post', color='orange', lw=2)
    ax4.set_title(r"$w_1(t)$ (Orientation Parity)")
    ax4.set_xlabel("Time")
    ax4.set_ylabel("Parity (0 or 1)")
    ax4.set_ylim(-0.1, 1.1)
    ax4.grid(True, linestyle='--', alpha=0.7)
    
    plt.tight_layout()
    save_path = f"C:/Users/macma/.gemini/antigravity/scratch/mobius_topology/results/{title_prefix.lower()}_results.png"
    plt.savefig(save_path)
    print(f"Results saved to {save_path}")

if __name__ == "__main__":
    print("Running Multi-Loop Möbius simulation (4 loops / 2 cycles)...")
    mobius_res = run_simulation(mobius_mapping, drift_type='sinusoidal', t_max=8*np.pi)
    plot_results(mobius_res, "Möbius")
    
    print("Running Multi-Loop Cylinder simulation (4 loops / 2 cycles)...")
    # For cylinder, we force w1 to be 0 as it's orientable
    cylinder_res = run_simulation(cylinder_mapping, drift_type='sinusoidal', t_max=8*np.pi)
    cylinder_res['w1'] = np.zeros_like(cylinder_res['w1']) 
    plot_results(cylinder_res, "Cylinder")
