/**
 * Centralized Python test code templates.
 * Contains all Python code used in tests to avoid hardcoding in TypeScript files.
 */

export const PythonTestTemplates = {
  /**
   * Basic Python test script for simple debugging scenarios
   */
  basicScript: `import numpy as np
try:
    from PIL import Image
except ImportError:
    Image = None

try:
    import matplotlib.pyplot as plt
except ImportError:
    plt = None

# Create test data
numpy_image = np.random.randint(0, 255, (50, 50, 3), dtype=np.uint8)
print("Created numpy image:", numpy_image.shape)

if Image:
    pil_image = Image.fromarray(numpy_image)
    print("Created PIL image:", pil_image.size)

if plt:
    fig, ax = plt.subplots()
    x = np.linspace(0, 10, 50)
    ax.plot(x, np.sin(x))
    ax.set_title("Test Plot")
    print("Created matplotlib plot")

print("Test data created - set breakpoint here")
`,

  /**
   * Complex Python test script with multiple data types and structures
   */
  complexScript: `import numpy as np
try:
    from PIL import Image
    import matplotlib.pyplot as plt
    import plotly.graph_objects as go
except ImportError as e:
    print(f"Import warning: {e}")

class TestDataContainer:
    def __init__(self):
        self.create_images()
        self.create_plots()
        self.create_tensors()
    
    def create_images(self):
        # Various image formats
        self.gray_image = np.random.randint(0, 255, (100, 100), dtype=np.uint8)
        self.rgb_image = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        self.float_image = np.random.random((100, 100)).astype(np.float32)
        
        try:
            self.pil_image = Image.fromarray(self.rgb_image)
        except:
            self.pil_image = None
    
    def create_plots(self):
        try:
            self.fig, self.ax = plt.subplots(figsize=(8, 6))
            x = np.linspace(0, 10, 100)
            self.ax.plot(x, np.sin(x), 'b-', label='sin')
            self.ax.plot(x, np.cos(x), 'r--', label='cos')
            self.ax.legend()
            self.ax.set_title('Trigonometric Functions')
        except:
            pass
    
    def create_tensors(self):
        # Multi-dimensional arrays and tensors
        self.tensor_3d = np.random.random((3, 64, 64)).astype(np.float32)
        self.tensor_4d = np.random.random((1, 3, 32, 32)).astype(np.float32)

# Create test container
container = TestDataContainer()
print("Complex test data created - set breakpoint here")
`,

  /**
   * Error handling and edge cases test script
   */
  errorTestScript: `import numpy as np

def test_edge_cases():
    # Edge cases that might cause issues
    empty_array = np.array([])
    print("Empty array:", empty_array.shape)
    
    single_pixel = np.array([[255]], dtype=np.uint8)
    print("Single pixel:", single_pixel.shape)
    
    # Arrays with special values
    nan_array = np.full((10, 10), np.nan)
    inf_array = np.full((10, 10), np.inf)
    
    # Very large array (commented to avoid memory issues)
    # large_array = np.random.random((1000, 1000, 3))
    
    # Invalid shapes for images
    invalid_shape = np.random.random((10, 10, 5))  # 5 channels
    
    print("Edge case data created - set breakpoint here")

test_edge_cases()
`,

  /**
   * Performance testing script with large data
   */
  performanceScript: `import numpy as np
import time

def create_performance_data():
    print("Creating performance test data...")
    
    # Large images
    large_grayscale = np.random.randint(0, 255, (1000, 1000), dtype=np.uint8)
    large_rgb = np.random.randint(0, 255, (1000, 1000, 3), dtype=np.uint8)
    
    # High precision arrays
    high_precision = np.random.random((500, 500)).astype(np.float64)
    
    # Memory usage test
    memory_test = [np.random.random((100, 100)) for _ in range(10)]
    
    print(f"Large grayscale: {large_grayscale.shape}")
    print(f"Large RGB: {large_rgb.shape}")
    print(f"High precision: {high_precision.shape}")
    print(f"Memory test arrays: {len(memory_test)}")
    print("Performance data created - set breakpoint here")

create_performance_data()
`,

  /**
   * Tensor-specific testing script for PyTorch and TensorFlow
   */
  tensorScript: `import numpy as np

# PyTorch tensors (if available)
try:
    import torch
    pytorch_available = True
    print("PyTorch available")
except ImportError:
    pytorch_available = False
    print("PyTorch not available")

# TensorFlow tensors (if available)
try:
    import tensorflow as tf
    tensorflow_available = True
    print("TensorFlow available")
except ImportError:
    tensorflow_available = False
    print("TensorFlow not available")

def create_tensor_data():
    # NumPy arrays as tensors
    numpy_tensor = np.random.random((3, 64, 64)).astype(np.float32)
    batch_tensor = np.random.random((4, 3, 32, 32)).astype(np.float32)
    
    print(f"NumPy tensor: {numpy_tensor.shape}")
    print(f"Batch tensor: {batch_tensor.shape}")
    
    if pytorch_available:
        torch_tensor = torch.rand(3, 64, 64)
        torch_batch = torch.rand(4, 3, 32, 32)
        print(f"PyTorch tensor: {torch_tensor.shape}")
        print(f"PyTorch batch: {torch_batch.shape}")
    
    if tensorflow_available:
        tf_tensor = tf.random.normal((3, 64, 64))
        tf_batch = tf.random.normal((4, 3, 32, 32))
        print(f"TensorFlow tensor: {tf_tensor.shape}")
        print(f"TensorFlow batch: {tf_batch.shape}")
    
    print("Tensor data created - set breakpoint here")

create_tensor_data()
`,

  /**
   * Plotting and visualization test script
   */
  plotScript: `import numpy as np

try:
    import matplotlib.pyplot as plt
    matplotlib_available = True
except ImportError:
    matplotlib_available = False
    print("Matplotlib not available")

try:
    import plotly.graph_objects as go
    import plotly.express as px
    plotly_available = True
except ImportError:
    plotly_available = False
    print("Plotly not available")

def create_plots():
    x = np.linspace(0, 10, 100)
    y1 = np.sin(x)
    y2 = np.cos(x)
    
    if matplotlib_available:
        # Simple line plot
        fig1, ax1 = plt.subplots()
        ax1.plot(x, y1, label='sin(x)')
        ax1.plot(x, y2, label='cos(x)')
        ax1.legend()
        ax1.set_title('Trigonometric Functions')
        
        # Subplots
        fig2, ((ax2, ax3), (ax4, ax5)) = plt.subplots(2, 2, figsize=(10, 8))
        ax2.plot(x, y1)
        ax2.set_title('sin(x)')
        ax3.plot(x, y2)
        ax3.set_title('cos(x)')
        ax4.scatter(x[::5], y1[::5])
        ax4.set_title('sin(x) scatter')
        ax5.hist(np.random.normal(0, 1, 1000))
        ax5.set_title('Normal distribution')
        
        print("Matplotlib plots created")
    
    if plotly_available:
        # Interactive plot
        plotly_fig = go.Figure()
        plotly_fig.add_trace(go.Scatter(x=x, y=y1, name='sin(x)'))
        plotly_fig.add_trace(go.Scatter(x=x, y=y2, name='cos(x)'))
        plotly_fig.update_layout(title='Interactive Plot')
        
        print("Plotly plot created")
    
    print("Plot data created - set breakpoint here")

create_plots()
`
};

/**
 * Helper to get Python script content by template name
 */
export function getPythonTemplate(templateName: keyof typeof PythonTestTemplates): string {
  return PythonTestTemplates[templateName];
}

/**
 * Available template names for type safety
 */
export type PythonTemplateNames = keyof typeof PythonTestTemplates;