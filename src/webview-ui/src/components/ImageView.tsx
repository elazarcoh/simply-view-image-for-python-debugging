import React, { useRef, useEffect } from "react";

interface ImageViewProps {
    imageData: ImageData;
}

const ImageView = ({ imageData }: ImageViewProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas === null) return;
        const ctx = canvas.getContext("2d");
        if (ctx === null) return;

        // Set canvas dimensions to match image dimensions
        canvas.width = imageData.width;
        canvas.height = imageData.height;

        // Draw image data onto canvas
        ctx.putImageData(imageData, 0, 0);
    }, [imageData]);

    return <canvas ref={canvasRef} />;
};

export default ImageView;
