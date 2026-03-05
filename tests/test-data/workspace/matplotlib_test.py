"""
Test file for matplotlib plot viewing.
Creates matplotlib figures for testing the View Plot feature.
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def main():
    # Simple line plot
    fig_line = plt.figure(figsize=(4, 3))
    x = np.linspace(0, 2 * np.pi, 100)
    plt.plot(x, np.sin(x), label="sin(x)")
    plt.plot(x, np.cos(x), label="cos(x)")
    plt.legend()
    plt.title("Trig Functions")

    # Bar chart in a separate figure
    fig_bar = plt.figure(figsize=(4, 3))
    categories = ["A", "B", "C", "D"]
    values = [4, 7, 2, 9]
    plt.bar(categories, values)
    plt.title("Bar Chart")

    breakpoint()

    print("Matplotlib test completed")


if __name__ == "__main__":
    main()
