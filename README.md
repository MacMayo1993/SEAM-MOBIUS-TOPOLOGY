# Möbius Strip Topological Flow Simulation

A framework for exploring topological invariants of particle trajectories on non-orientable manifolds.

## Overview

This project simulates particle trajectories on a **Möbius strip** (non-orientable) and a **Cylinder** (orientable) to analyze how surface topology influences global flow diagnostics.

### Core Diagnostics

- **$\theta(t)$**: Phase angle of the velocity vector (unwrapped). Tracks local directional changes.
- **$\delta(t)$**: Distance to the central seam ($v=0$). A robust geometric indicator.
- **$w_1(t)$**: Orientation parity. Specifically designed to detect the Möbius twist using frame transport/radial projection.

## Project Structure

```
mobius_topology/
├── mobius_flow.py         # Main simulation and visualization script
├── results/               # Generated plots (PNG)
├── data/                  # Raw diagnostic data (NumPy arrays)
├── tests/                 # Geometric and stability validation
└── README.md              # This file
```

## Quick Start

### GitHub Codespaces (Recommended)
Open in Codespaces for instant setup with all dependencies:
```bash
./start_servers.sh
```
See [CODESPACES.md](CODESPACES.md) for detailed instructions.

### Local Development

1. **Install Dependencies**:
   ```bash
   pip install numpy matplotlib scipy
   npm install
   ```

2. **Run Simulation**:
   ```bash
   python mobius_flow.py
   ```
   Generates 3D trajectory plots and time-series diagnostics in `results/` folder.

3. **Run Tests**:
   ```bash
   python tests/test_geometry.py    # Validates orthogonality and normal flip
   python tests/test_loops.py       # Validates parity stability
   ```

4. **Start Interactive Web Visualization**:
   ```bash
   npm run dev     # Vite dev server on port 5173
   ```
   Or use the startup script:
   ```bash
   ./start_servers.sh
   ```

## Interactive Visualization

Access the 3D interactive visualization at `http://localhost:5173` after running the dev server.

Features:
- Real-time Möbius strip particle simulation
- Adjustable physics parameters (drift, flow dynamics)
- Multiple manifold topologies (Möbius, Cylinder, Torus, Trefoil)
- Visual orientation tracking with w₁ parity detection
- Camera controls and material options

## Theory

The parity flip $w_1$ is detected by observing the sign of the transverse tangent vector relative to the radial vector of the embedding. On a Möbius strip, this sign reverses every $2\pi$ traversal of the central loop, whereas on a cylinder, it remains constant.
