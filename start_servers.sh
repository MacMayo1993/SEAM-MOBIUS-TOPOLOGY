#!/bin/bash
# Start servers for Möbius Topology Simulation
# Compatible with GitHub Codespaces and local development

echo "🚀 Starting Möbius Topology Simulation Servers..."
echo ""

# Kill any existing servers on these ports
pkill -f "python -m http.server 8000" 2>/dev/null
pkill -f "vite.*5173" 2>/dev/null
sleep 1

# Start Python HTTP server for static files
echo "📊 Starting Python HTTP Server on port 8000..."
python -m http.server 8000 --bind 0.0.0.0 > /tmp/http_server.log 2>&1 &
HTTP_PID=$!

sleep 2

# Start Vite dev server for interactive 3D visualization
echo "🎨 Starting Vite Dev Server on port 5173..."
npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/vite_server.log 2>&1 &
VITE_PID=$!

sleep 3

# Check if servers are running
if ps -p $HTTP_PID > /dev/null; then
    echo "✅ Python HTTP Server running (PID: $HTTP_PID)"
else
    echo "❌ Python HTTP Server failed to start"
    cat /tmp/http_server.log
fi

if ps -p $VITE_PID > /dev/null; then
    echo "✅ Vite Dev Server running (PID: $VITE_PID)"
else
    echo "❌ Vite Dev Server failed to start"
    cat /tmp/vite_server.log
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Access the application:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  📱 Interactive 3D Visualization (Vite):"
echo "     http://localhost:5173"
echo ""
echo "  📊 Simulation Results (Python):"
echo "     http://localhost:8000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 In GitHub Codespaces:"
echo "   - Ports will auto-forward and show in PORTS tab"
echo "   - Click the globe icon to open in browser"
echo "   - Or use the forwarded URLs provided"
echo ""
echo "🛑 To stop servers: pkill -f 'http.server|vite'"
echo ""
