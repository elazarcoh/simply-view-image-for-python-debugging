import ImageView from "./ImageView";
import "./ImagesGrid.css";
import { useEffect, useLayoutEffect, useState } from "react";
import React from "react";
import useMeasure from "react-use-measure";

export interface ImageGridFlowProps {
    images: ImageData[];
}

function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        function (c) {
            var r = (Math.random() * 16) | 0,
                v = c == "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        }
    );
}

function useWindowSize() {
    const [size, setSize] = useState([0, 0]);
    useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
        }
        window.addEventListener("resize", updateSize);
        updateSize();
        return () => window.removeEventListener("resize", updateSize);
    }, []);
    return size;
}

function findOptimalGrid(
    numImages: number,
    width: number,
    height: number,
    gap: number
): {
    numRows: number;
    numColumns: number;
    sideSize: number;
} {
    let [[bestNumRows, bestNumColumns, bestSideSize], emptySpace] = [
        [0, 0, 0],
        Infinity,
    ];
    for (let i = 1; i <= numImages; i++) {
        const columns = i;
        const rows = Math.ceil(numImages / columns);
        const sideSize = Math.min(
            (width - (columns - 1) * gap) / columns,
            (height - (rows - 1) * gap) / rows
        );
        const gapTotal = gap * (columns - 1) + gap * (rows - 1);
        const newEmptySpace =
            width * height - sideSize * sideSize * numImages - gapTotal;
        const isValid =
            rows * columns >= numImages &&
            rows * sideSize + (rows - 1) * gap <= height &&
            columns * sideSize + (columns - 1) * gap <= width &&
            newEmptySpace >= 0;

        if (newEmptySpace < emptySpace && isValid) {
            console.log(
                "new best: c: %d, r: %d, s: %d, es: %d",
                columns,
                rows,
                sideSize,
                newEmptySpace
            );
            emptySpace = newEmptySpace;
            bestNumRows = rows;
            bestNumColumns = columns;
            bestSideSize = sideSize;
        }
    }
    return {
        numRows: bestNumRows,
        numColumns: bestNumColumns,
        sideSize: bestSideSize,
    };
}

const safeParseInt = (str: string) => {
    const num = Number.parseInt(str);
    return Number.isNaN(num) ? undefined : num;
};

const ImageGridInner = React.forwardRef<HTMLDivElement, ImageGridFlowProps>(
    ({ images }, parentRef) => {
        const numImages = images.length;

        const [ref, bounds] = useMeasure();
        const width = bounds.width;
        const height = bounds.height;
        // const [setRef, { width, height }] = useMeasure();
        // useEffect(() => {
        //     if (
        //         parentRef != null &&
        //         typeof parentRef !== "function" &&
        //         parentRef.current != null
        //     ) {
        //         setRef(parentRef.current);
        //     }
        // }, []);

        // ask css for the gap
        // const gap =
        //     safeParseInt(
        //         window
        //             .getComputedStyle(document.documentElement)
        //             .getPropertyValue("--image-grid-gap")
        //     ) ?? 0;

        // const { numRows, numColumns, sideSize } = findOptimalGrid(
        //     numImages,
        //     width,
        //     height,
        //     gap
        // );

        // console.log(
        //     "numRows: %d, numColumns: %d, sideSize: %d, width: %d, height: %d",
        //     numRows,
        //     numColumns,
        //     sideSize,
        //     width,
        //     height
        // );

        const gridStyle = {
            // gridTemplateColumns: `repeat(${numColumns}, ${sideSize}px)`,
            // gridTemplateRows: `repeat(${numRows}, ${sideSize}px)`,
        };
        return (
            <div className="image-grid" style={gridStyle} ref={ref}>
                {images.map((image) => (
                    <ImageView imageData={image} key={uuid()} />
                ))}
            </div>
        );
    }
);

const ImageGrid = (props: ImageGridFlowProps) => {
    return <ImageGridInner {...props} />;
};

export default ImageGrid;
