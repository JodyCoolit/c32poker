#!/bin/bash

# Stop running containers
docker-compose down

# Rebuild images with the new configuration
docker-compose build

# Start containers
docker-compose up -d

echo "Containers have been rebuilt and restarted."
echo "Frontend should be available at http://localhost:8888"
echo "Backend API should be available at http://localhost:8000" 