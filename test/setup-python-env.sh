#!/bin/bash

# Setup script for Python test environment
# This script creates a virtual environment and installs required packages for testing

set -e

echo "Setting up Python test environment..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8+ to continue."
    exit 1
fi

# Create test directory if it doesn't exist
TEST_DIR="$(dirname "$0")"
cd "$TEST_DIR"

# Create virtual environment if it doesn't exist
VENV_DIR="test-env"
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    source "$VENV_DIR/Scripts/activate"
else
    source "$VENV_DIR/bin/activate"
fi

echo "Installing Python packages..."
pip install --upgrade pip

# Core dependencies for image/tensor/plot testing
pip install "numpy>=1.20.0"
pip install "Pillow"
pip install "matplotlib"
pip install "plotly"

# Optional dependencies (install if available)
echo "Installing optional dependencies..."
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu || echo "PyTorch installation failed, continuing..."
pip install "tensorflow>=2.8.0" || echo "TensorFlow installation failed, continuing..."
pip install "scikit-image" || echo "scikit-image installation failed, continuing..."
pip install "opencv-python" || echo "OpenCV installation failed, continuing..."
pip install "imageio" || echo "imageio installation failed, continuing..."

echo "Python test environment setup complete!"
echo "To activate the environment manually, run:"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "  source $TEST_DIR/$VENV_DIR/Scripts/activate"
else
    echo "  source $TEST_DIR/$VENV_DIR/bin/activate"
fi