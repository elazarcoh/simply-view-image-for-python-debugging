import numpy as np

def main():
    x = np.array([
        [255, 0, 0], 
        [0, 255, 0], 
        [0, 0, 255], 
        [255, 255, 255]
    ],
    dtype=np.uint8
    ).reshape(2, 2, 3)


    breakpoint()
    
    print("Script execution completed")

if __name__ == "__main__":
    main()