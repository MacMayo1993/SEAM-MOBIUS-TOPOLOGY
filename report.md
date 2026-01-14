# Technical Report: Exploring Topological Invariants on Non-Orientable Manifolds

**Date**: December 21, 2025  
**Topic**: Topological Diagnostics of Fluid Flow Trajectories via Frame Transport

## Abstract
We present a modular Lagrangian framework for analyzing fluid flow trajectories on non-orientable manifolds. By tracking the orientation of a surface-normal frame transported along a particle path, we define a robust parity invariant $w_1$ that distinguishes between orientable (Cylinder) and non-orientable (Möbius) surface topologies, even under identical local flow conditions.

## 1. Modular Architecture
The framework is decomposed into three primary layers to ensure scalability and ease of integration into larger CFD environments:
- **Core Package**: Handles the differential geometry mappings and the numerical integration of trajectories using a Runge-Kutta 4(5) solver.
- **Analysis Package**: Extracts geometric signatures ($\theta, \delta$) and computes the $w_1$ parity via frame transport analysis.
- **Plot Package**: Provides 3D visualization and time-series diagnostics.

## 2. Methodology: Normal Frame Transport
The orientation parity $w_1$ is detected by observing the evolution of the surface normal $\vec{n}(u, v) = \frac{\vec{r}_u \times \vec{r}_v}{|\vec{r}_u \times \vec{r}_v|}$. 

On a Möbius strip, the standard embedding identifies $(u, v) \sim (u+2\pi, -v)$. After one full traversal ($u: 0 \to 2\pi$), the normal vector satisfies $\vec{n}(2\pi, v) = -\vec{n}(0, v)$. We detect this topological flip by tracking the projection of the current normal onto the initial normal:
$$w_1(t) = \begin{cases} 0 & \text{if } \vec{n}(t) \cdot \vec{n}(0) > 0 \\ 1 & \text{if } \vec{n}(t) \cdot \vec{n}(0) \leq 0 \end{cases}$$

## 3. Results & Validation
Multi-loop simulations (up to $6\pi$) show that $w_1$ toggles correctly as the particle crosses the "twist" region of the Möbius strip. In contrast, on a Cylinder embedding, the normal projection remains positive for all $t$, resulting in $w_1 = 0$ as expected for an orientable manifold.

## 4. Scaling to 3D and Higher Topologies

### 4.1 Local Non-Orientability in ℝ³?
We investigated whether helical flow structures (Hopf Fibration, DNA Vortex) could induce a non-zero $w_1$. Our results definitively show that in orientable ℝ³, $w_1$ remains identically zero regardless of the geometric complexity or "twist" of the flow lines. This establishes $w_1$ as a strictly topological diagnostic.

### 4.2 The Klein Bottle Invariant
Simulation on the Klein Bottle (Figure-8 immersion) demonstrates that $w_1$ accurately tracks parity flips in non-orientable 2-manifolds. The Klein Bottle's double-twist topology provides a richer signature set for multi-path trajectories.

## 5. Conclusion
The "Topological Frame Parity" method is a robust detector of manifold non-orientability. By demonstrating that $w_1$ is invariant to geometric "pseudotwists" in ℝ³ but sensitive to global manifold twists, we provide a mathematical foundation for applying topological sensors to complex fluid and plasma simulations.
