#!/bin/bash

echo "Starting Safar Saathi System..."
echo

# Function to start service in background
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    local command=$4
    
    echo "Starting $name (Port $port)..."
    cd "$dir" && $command &
    local pid=$!
    echo "$name started with PID $pid"
    cd ..
}

# Start User Backend (Port 5000)
start_service "User Backend" "backend" "5000" "npm run dev"

# Start Driver Backend (Port 5001)
start_service "Driver Backend" "../Driver_Panel/backend" "5001" "npm run dev"

# Wait for backends to start
echo "Waiting for backends to start..."
sleep 5

# Start User Panel (Port 3000)
start_service "User Panel" "frontend" "3000" "npm run dev"

# Start Driver Panel (Port 3001)
start_service "Driver Panel" "../Driver_Panel/frontend" "3001" "npm run dev"

echo
echo "All services starting..."
echo "- User Backend: http://localhost:5000"
echo "- Driver Backend: http://localhost:5001"
echo "- User Panel: http://localhost:3000"
echo "- Driver Panel: http://localhost:3001"
echo
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait
