# Running in GitHub Codespaces

This project is fully configured to run in GitHub Codespaces with automatic port forwarding and dependency installation.

## Quick Start

### 1. Open in Codespaces

Click the **Code** button on GitHub → **Codespaces** → **Create codespace on [branch]**

### 2. Wait for Setup

The devcontainer will automatically:
- Install Python dependencies (numpy, matplotlib, scipy)
- Install Node.js dependencies (three, vite)
- Configure port forwarding for ports 5173 and 8000

### 3. Start the Application

Run the startup script:
```bash
./start_servers.sh
```

Or manually start each component:

**Run Python simulation:**
```bash
python mobius_flow.py
```

**Run tests:**
```bash
python tests/test_geometry.py
python tests/test_loops.py
```

**Start servers:**
```bash
# Terminal 1: Python HTTP server for results
python -m http.server 8000 --bind 0.0.0.0

# Terminal 2: Vite dev server for 3D visualization
npm run dev -- --host 0.0.0.0 --port 5173
```

### 4. Access the Application

GitHub Codespaces will automatically forward ports. Look for notifications or check the **PORTS** tab:

- **Port 5173**: Interactive 3D Visualization (Vite)
- **Port 8000**: Simulation Results (Python)

Click the 🌐 globe icon next to each port to open in your browser.

## Port Forwarding

Ports are configured to be **public** and accessible from outside the codespace:

| Port | Service | Purpose |
|------|---------|---------|
| 5173 | Vite Dev Server | Interactive 3D Möbius visualization |
| 8000 | Python HTTP | Static simulation results and plots |

## Troubleshooting

### Ports not forwarding?
1. Check the **PORTS** tab in VS Code
2. Right-click the port → **Port Visibility** → **Public**
3. Click the globe icon to open

### Server not starting?
```bash
# Check what's running on ports
lsof -i :5173
lsof -i :8000

# Kill existing processes
pkill -f "vite"
pkill -f "http.server"

# Restart
./start_servers.sh
```

### Dependencies missing?
```bash
# Reinstall Python dependencies
pip install numpy matplotlib scipy

# Reinstall Node dependencies
npm install
```

## Features in Codespaces

✅ Automatic dependency installation
✅ Pre-configured port forwarding
✅ Python 3.11 environment
✅ Node.js 20 environment
✅ VS Code extensions (Python, Pylance)
✅ Easy sharing via forwarded URLs

## Development Workflow

1. Edit code in Codespaces
2. Changes hot-reload automatically (Vite)
3. Run tests: `python tests/test_geometry.py`
4. View results instantly in forwarded browser tabs
5. Commit and push directly from Codespaces

Enjoy exploring topological invariants! 🎨✨
