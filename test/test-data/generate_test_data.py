"""
Test data generators for Simply View Image extension testing.
This module creates various types of images, plots, and tensors for testing.
"""

import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from PIL import Image
import plotly.graph_objects as go
import plotly.express as px
import os
import json
from pathlib import Path
from python_script_templates import TEMPLATES

def create_test_images():
    """Create various types of test images as numpy arrays."""
    images = {}
    
    # Basic grayscale image
    images['gray_square'] = np.ones((100, 100), dtype=np.uint8) * 128
    
    # RGB color image
    rgb_image = np.zeros((100, 100, 3), dtype=np.uint8)
    rgb_image[:, :, 0] = 255  # Red channel
    rgb_image[25:75, 25:75, 1] = 255  # Green square in center
    images['rgb_square'] = rgb_image
    
    # Float image
    x = np.linspace(-2, 2, 100)
    y = np.linspace(-2, 2, 100)
    X, Y = np.meshgrid(x, y)
    images['float_wave'] = np.sin(X) * np.cos(Y)
    
    # Large image for performance testing
    images['large_random'] = np.random.randint(0, 255, (500, 500, 3), dtype=np.uint8)
    
    # Edge cases
    images['empty'] = np.array([])
    images['single_pixel'] = np.array([[255]], dtype=np.uint8)
    images['with_nan'] = np.full((50, 50), np.nan)
    images['with_inf'] = np.full((50, 50), np.inf)
    
    # Different data types
    images['uint16'] = np.random.randint(0, 65535, (50, 50), dtype=np.uint16)
    images['int32'] = np.random.randint(-1000, 1000, (50, 50), dtype=np.int32)
    images['float64'] = np.random.random((50, 50)).astype(np.float64)
    
    return images

def create_pil_images():
    """Create PIL Image objects for testing."""
    images = {}
    
    # Create a simple gradient
    img = Image.new('RGB', (100, 100))
    pixels = []
    for y in range(100):
        for x in range(100):
            pixels.append((x * 255 // 100, y * 255 // 100, 128))
    img.putdata(pixels)
    images['pil_gradient'] = img
    
    # Create different modes
    images['pil_grayscale'] = Image.new('L', (50, 50), 128)
    images['pil_rgba'] = Image.new('RGBA', (50, 50), (255, 0, 0, 128))
    
    return images

def create_matplotlib_plots():
    """Create various matplotlib figures for testing."""
    plots = {}
    
    # Simple line plot
    fig1, ax1 = plt.subplots()
    x = np.linspace(0, 10, 100)
    ax1.plot(x, np.sin(x), label='sin(x)')
    ax1.plot(x, np.cos(x), label='cos(x)')
    ax1.legend()
    ax1.set_title('Trigonometric Functions')
    plots['line_plot'] = fig1
    
    # Scatter plot
    fig2, ax2 = plt.subplots()
    x = np.random.randn(100)
    y = np.random.randn(100)
    colors = np.random.rand(100)
    ax2.scatter(x, y, c=colors, alpha=0.6)
    ax2.set_title('Random Scatter Plot')
    plots['scatter_plot'] = fig2
    
    # Image plot
    fig3, ax3 = plt.subplots()
    data = np.random.random((20, 20))
    im = ax3.imshow(data, cmap='viridis')
    plt.colorbar(im, ax=ax3)
    ax3.set_title('Random Image Data')
    plots['image_plot'] = fig3
    
    # Subplot figure
    fig4, ((ax4a, ax4b), (ax4c, ax4d)) = plt.subplots(2, 2, figsize=(8, 6))
    ax4a.plot([1, 2, 3, 4], [1, 4, 2, 3])
    ax4b.bar(['A', 'B', 'C'], [1, 3, 2])
    ax4c.hist(np.random.randn(1000), bins=30)
    ax4d.pie([1, 2, 3, 4], labels=['A', 'B', 'C', 'D'])
    plt.tight_layout()
    plots['subplots'] = fig4
    
    return plots

def create_plotly_plots():
    """Create various plotly figures for testing."""
    plots = {}
    
    # Simple line plot
    x = np.linspace(0, 10, 100)
    plots['plotly_line'] = go.Figure(data=go.Scatter(x=x, y=np.sin(x), name='sin(x)'))
    
    # 3D surface plot
    x = np.linspace(-5, 5, 30)
    y = np.linspace(-5, 5, 30)
    X, Y = np.meshgrid(x, y)
    Z = np.sin(np.sqrt(X**2 + Y**2))
    plots['plotly_3d'] = go.Figure(data=[go.Surface(z=Z, x=X, y=Y)])
    
    # Heatmap
    z = np.random.randn(20, 20)
    plots['plotly_heatmap'] = go.Figure(data=go.Heatmap(z=z))
    
    return plots

def create_tensor_data():
    """Create various tensor-like data structures."""
    tensors = {}
    
    # NumPy tensors
    tensors['numpy_1d'] = np.array([1, 2, 3, 4, 5])
    tensors['numpy_2d'] = np.random.random((5, 5))
    tensors['numpy_3d'] = np.random.random((3, 4, 5))
    tensors['numpy_4d'] = np.random.random((2, 3, 4, 5))
    
    # Try to create PyTorch tensors if available
    try:
        import torch
        tensors['torch_1d'] = torch.tensor([1, 2, 3, 4, 5])
        tensors['torch_2d'] = torch.randn(5, 5)
        tensors['torch_3d'] = torch.randn(3, 4, 5)
        tensors['torch_cuda'] = torch.randn(3, 3)  # Will be CPU since no GPU
    except ImportError:
        print("PyTorch not available, skipping torch tensors")
    
    # Try to create TensorFlow tensors if available
    try:
        import tensorflow as tf
        tensors['tf_1d'] = tf.constant([1, 2, 3, 4, 5])
        tensors['tf_2d'] = tf.random.normal((5, 5))
        tensors['tf_3d'] = tf.random.normal((3, 4, 5))
    except ImportError:
        print("TensorFlow not available, skipping tf tensors")
    
    return tensors

def generate_test_scripts():
    """Generate Python test scripts for debugging scenarios using centralized templates."""
    scripts_dir = Path(__file__).parent / 'fixtures'
    scripts_dir.mkdir(exist_ok=True)
    
    # Generate all test scripts from templates
    script_files = {
        'basic_test.py': TEMPLATES['basic'],
        'complex_test.py': TEMPLATES['complex'],
        'error_test.py': TEMPLATES['error'],
        'performance_test.py': TEMPLATES['performance'],
        'tensor_test.py': TEMPLATES['tensor'],
        'plot_test.py': TEMPLATES['plot']
    }
    
    for filename, content in script_files.items():
        with open(scripts_dir / filename, 'w') as f:
            f.write(content)
        print(f"Generated {filename}")
    
    print(f"Created {len(script_files)} Python test scripts in {scripts_dir}")

def save_test_metadata():
    """Save metadata about test data for reference."""
    metadata = {
        'numpy_images': list(create_test_images().keys()),
        'pil_images': list(create_pil_images().keys()),
        'tensors': list(create_tensor_data().keys()),
        'test_scripts': [
            'basic_test.py',
            'complex_test.py',
            'error_test.py',
            'performance_test.py',
            'tensor_test.py',
            'plot_test.py'
        ],
        'matplotlib_plots': ['line_plot', 'scatter_plot', 'image_plot', 'subplots'],
        'plotly_plots': ['plotly_line', 'plotly_3d', 'plotly_heatmap']
    }
    
    with open(Path(__file__).parent / 'test_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)

if __name__ == '__main__':
    print("Generating test data and scripts...")
    generate_test_scripts()
    save_test_metadata()
    print("Test data generation complete!")
    
    # Test data creation to verify everything works
    print("Creating test images...")
    images = create_test_images()
    print(f"Created {len(images)} numpy images")
    
    print("Creating PIL images...")
    pil_images = create_pil_images()
    print(f"Created {len(pil_images)} PIL images")
    
    print("Creating matplotlib plots...")
    plots = create_matplotlib_plots()
    print(f"Created {len(plots)} matplotlib plots")
    
    try:
        print("Creating plotly plots...")
        plotly_plots = create_plotly_plots()
        print(f"Created {len(plotly_plots)} plotly plots")
    except ImportError:
        print("Plotly not available")
    
    print("Creating tensor data...")
    tensors = create_tensor_data()
    print(f"Created {len(tensors)} tensors")
    
    print("All test data created successfully!")