import React, { useRef, useEffect } from "react";
import "./ImageView.css";

interface ImageViewProps {
    imageData: ImageData;
}

type CurrentView = {
    sx: number; // source x
    sy: number; // source y
    sw: number; // source width
    sh: number; // source height
    dx: number; // destination x
    dy: number; // destination y
    dw: number; // destination width
    dh: number; // destination height
};

type ImageViewData = {
    imageData: ImageData;
    currentView: CurrentView | undefined;
};

type Cursor = {
    x: number;
    y: number;
};

type Pixel<T> = {
    x: number;
    y: number;
    value: T;
};

type BoundingRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type ImageViewContextType = {
    imageData: ImageData;
    currentView: CurrentView | undefined;
    cursor: Cursor | undefined;
    setCurrentView: (currentView: CurrentView) => void;
    setCursor: (cursor: Cursor | undefined) => void;
};

const ImageViewContext = React.createContext<ImageViewContextType>({
    imageData: new ImageData(1, 1),
    currentView: undefined,
    cursor: undefined,
    setCurrentView: () => {},
    setCursor: () => {},
});

function isInRect(rect: BoundingRect, { x, y }: Cursor): boolean {
    return (
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height
    );
}

function cursorRelativeToRect(rect: BoundingRect, { x, y }: Cursor): Cursor {
    return {
        x: x - rect.x,
        y: y - rect.y,
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function getPixel(
    imageData: ImageData,
    { x, y }: Cursor
): Pixel<[number, number, number, number]> {
    const ix = clamp(Math.floor(x), 0, imageData.width - 1);
    const iy = clamp(Math.floor(y), 0, imageData.height - 1);
    const index = (iy * imageData.width + ix) * 4;
    console.log("index: %d, x: %d, y: %d", index, ix, iy);
    return {
        x: ix,
        y: iy,
        value: [
            imageData.data[index],
            imageData.data[index + 1],
            imageData.data[index + 2],
            imageData.data[index + 3],
        ],
    };
}

function drawImage(
    ctx: CanvasRenderingContext2D,
    imageData: ImageData,
    cv: CurrentView
): void {
    ctx.putImageData(imageData, cv.dx, cv.dy, cv.sx, cv.sy, cv.sw, cv.sh);
}

function drawImageOnCanvas(
    canvas: HTMLCanvasElement,
    imageData: ImageData
): CurrentView | undefined {
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    // Set canvas dimensions to match image dimensions
    const canvasSize = Math.max(imageData.width, imageData.height);
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Center image
    const x = (canvasSize - imageData.width) / 2;
    const y = (canvasSize - imageData.height) / 2;

    // Draw image data onto canvas
    const currentView = {
        sx: 0,
        sy: 0,
        sw: imageData.width,
        sh: imageData.height,
        dx: x,
        dy: y,
        dw: imageData.width,
        dh: imageData.height,
    };
    drawImage(ctx, imageData, currentView);

    return currentView;
}

function positionInCanvasCoordinates(
    canvas: HTMLCanvasElement,
    { x, y }: Cursor
): Cursor {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (x - rect.left) * (canvas.width / rect.width),
        y: (y - rect.top) * (canvas.height / rect.height),
    };
}

const addListeners = (
    canvas: HTMLCanvasElement,
    imageViewContext: ImageViewContextType
) => {
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;

    const hover = (e: MouseEvent) => {
        if (imageViewContext.currentView === undefined) return;
        const cursor = positionInCanvasCoordinates(canvas, { x: e.x, y: e.y });
        const imageOnCanvasBoundingRect = {
            x: imageViewContext.currentView.dx,
            y: imageViewContext.currentView.dy,
            width: imageViewContext.currentView.dw,
            height: imageViewContext.currentView.dh,
        };

        if (!isInRect(imageOnCanvasBoundingRect, cursor)) {
            imageViewContext.setCursor(undefined);
            return;
        }

        const cursorInRect = cursorRelativeToRect(
            imageOnCanvasBoundingRect,
            cursor
        );

        imageViewContext.setCursor(cursorInRect);
    };

    canvas.addEventListener("mousemove", hover);

    return () => {
        canvas.removeEventListener("mousemove", hover);
    };
};

const ImageViewInfo = () => {
    const { imageData, cursor } = React.useContext(ImageViewContext);
    const pixel = cursor ? getPixel(imageData, cursor) : undefined;

    return (
        <div className="image-view-info">
            <span>x: {pixel?.x ?? ""}</span>
            <span>y: {pixel?.y ?? ""}</span>
            <span>value: {pixel?.value[0] ?? ""}</span>
        </div>
    );
};

const ImageViewImpl = ({ imageData }: ImageViewProps) => {
    const imageViewContext = React.useContext(ImageViewContext);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (canvasRef.current === null) return;
        const drawnImageInfo = drawImageOnCanvas(canvasRef.current, imageData);
        if (drawnImageInfo === undefined) return;
        imageViewContext.setCurrentView(drawnImageInfo);
        console.log(drawnImageInfo);
        console.log(
            "canvas size w: %d, h: %d",
            canvasRef.current.width,
            canvasRef.current.height
        );

        return addListeners(canvasRef.current, imageViewContext);
    }, [imageData]);

    return (
        <div className="image-view">
            <canvas className="image-view-canvas" ref={canvasRef} />
            <ImageViewInfo />
        </div>
    );
};

const ImageView = ({ imageData }: ImageViewProps) => {
    const imageViewContext = React.useContext(ImageViewContext);
    const [cursor, setCursor] = React.useState<Cursor | undefined>(undefined);
    const [currentView, setCurrentView] = React.useState<
        CurrentView | undefined
    >(undefined);
    imageViewContext.imageData = imageData;
    imageViewContext.cursor = cursor;
    imageViewContext.currentView = currentView;
    imageViewContext.setCursor = setCursor;
    imageViewContext.setCurrentView = setCurrentView;

    return (
        <ImageViewContext.Provider value={imageViewContext}>
            <ImageViewImpl imageData={imageData} />
        </ImageViewContext.Provider>
    );
};

export default ImageView;
