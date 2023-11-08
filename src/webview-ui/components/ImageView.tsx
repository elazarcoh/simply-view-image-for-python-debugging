import React, { useRef, useEffect } from "react";
import "./ImageView.css";

interface ImageViewProps {
    imageData: ImageData;
}

const ImageView = ({ imageData }: ImageViewProps) => {
    // const canvasRef = useRef<HTMLCanvasElement>(null);

    // useEffect(() => {
    //     const canvas = canvasRef.current;
    //     if (canvas === null) return;
    //     const ctx = canvas.getContext("2d");
    //     if (ctx === null) return;

    //     // Set canvas dimensions to match image dimensions
    //     const canvasSize = Math.max(imageData.width, imageData.height);
    //     canvas.width = canvasSize;
    //     canvas.height = canvasSize;

    //     // Center image
    //     const x = (canvasSize - imageData.width) / 2;
    //     const y = (canvasSize - imageData.height) / 2;

    //     // Draw image data onto canvas
    //     ctx.putImageData(imageData, x, y);
    // }, [imageData]);

    // return <canvas className="image-view" ref={canvasRef} />;
    return (
        <div className="image-view">
            <img src="https://via.placeholder.com/1550" alt="" />
        </div>
    );
};

export default ImageView;
