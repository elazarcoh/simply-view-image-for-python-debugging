"""
Main workflow test script for Simply View Image for Python Debugging extension.
This script creates various types of image and tensor data that the extension can visualize.
Uses built-in Python data structures to simulate numpy arrays for testing purposes.
"""

def create_sample_image():
    """Create a sample list structure representing an image (simulating numpy array)."""
    # Create a simple 100x100 RGB image with a gradient pattern using nested lists
    height, width = 100, 100
    image = []
    
    # Create a colorful gradient pattern
    for i in range(height):
        row = []
        for j in range(width):
            pixel = [
                int((i / height) * 255),  # Red gradient
                int((j / width) * 255),   # Green gradient
                int(((i + j) / (height + width)) * 255)  # Blue gradient
            ]
            row.append(pixel)
        image.append(row)
    
    return image

def create_sample_tensor():
    """Create a sample nested list structure representing a tensor."""
    # Create a 3D tensor structure (could represent a batch of images or feature maps)
    import random
    tensor = []
    for batch in range(10):
        matrix = []
        for i in range(28):
            row = []
            for j in range(28):
                row.append(random.random())  # Random float values
            matrix.append(row)
        tensor.append(matrix)
    return tensor

def create_numpy_like_array(shape, dtype='float32'):
    """Create a nested list structure that simulates a numpy array."""
    import random
    
    def create_nested(dims):
        if len(dims) == 1:
            if dtype == 'uint8':
                return [random.randint(0, 255) for _ in range(dims[0])]
            else:
                return [random.random() for _ in range(dims[0])]
        else:
            return [create_nested(dims[1:]) for _ in range(dims[0])]
    
    return create_nested(shape)

def main():
    """Main function that creates image data for debugging and visualization."""
    # Set a simple variable for basic debugging
    x = "hello"
    print(f"The value of x is: {x}")  # Breakpoint location 1
    
    # Create sample image data
    sample_image = create_sample_image()
    print(f"Created sample image with shape: {len(sample_image)}x{len(sample_image[0])}x{len(sample_image[0][0])}")  # Breakpoint location 2
    
    # Create sample tensor data
    sample_tensor = create_sample_tensor()
    print(f"Created sample tensor with shape: {len(sample_tensor)}x{len(sample_tensor[0])}x{len(sample_tensor[0][0])}")  # Breakpoint location 3
    
    # Create some additional array-like structures of different types
    grayscale_image = create_numpy_like_array([64, 64], 'uint8')
    float_image = create_numpy_like_array([32, 32, 3], 'float32')
    
    print(f"Created grayscale image with shape: {len(grayscale_image)}x{len(grayscale_image[0])}")  # Breakpoint location 4
    print(f"Created float image with shape: {len(float_image)}x{len(float_image[0])}x{len(float_image[0][0])}")  # Breakpoint location 5
    
    # Create a larger tensor for testing
    large_tensor = create_numpy_like_array([5, 64, 64, 3], 'float32')
    print(f"Created large tensor with shape: {len(large_tensor)}x{len(large_tensor[0])}x{len(large_tensor[0][0])}x{len(large_tensor[0][0][0])}")  # Breakpoint location 6
    
    # Add some metadata that the extension might use
    image_metadata = {
        'sample_image': {
            'shape': (len(sample_image), len(sample_image[0]), len(sample_image[0][0])),
            'dtype': 'uint8',
            'description': 'RGB gradient image'
        },
        'sample_tensor': {
            'shape': (len(sample_tensor), len(sample_tensor[0]), len(sample_tensor[0][0])),
            'dtype': 'float32',
            'description': 'Random tensor data'
        }
    }
    
    print("Image metadata:", image_metadata)  # Breakpoint location 7
    print("Main workflow test script execution completed")

if __name__ == "__main__":
    main()