import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import RadioButtonGroup from "./components/RadioButtonGroup";
import SelectableImage from "./components/SelectableImage";
import React, { useEffect } from "react";
import { messageHandlerInstance } from "./../utils/MessageHandler";
import ImagesGridFlow from "./components/ImagesGrid";
import { useMeasure } from "react-use";
import Plot from "react-plotly.js";

// enum GalleryStyle {
//     Single,
//     Dual,
//     Grid,
// }

// enum OtherImagesStyle {
//     Thumbnails,
//     Names,
// }
// const ImageViewGallery = ({ galleryStyle, otherImagesStyle }) => {};
// const BASE64_MARKER = ";base64,";

const messageHandler = messageHandlerInstance<WebviewPushCommands>();

// function convertDataURIToBinary(dataURI: string) {
//     const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
//     const base64 = dataURI.substring(base64Index);
//     const raw = window.atob(base64);
//     const rawLength = raw.length;
//     const array = new Uint8ClampedArray(new ArrayBuffer(rawLength));

//     for (let i = 0; i < rawLength; i++) {
//         array[i] = raw.charCodeAt(i);
//     }
//     return array;
// }
function convertURIToImageData(URI: string): Promise<ImageData> {
    return new Promise(function (resolve, reject) {
        if (URI == null) return reject();
        // console.log("has URI");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (context === null) return reject();
        // console.log("has context");
        const image = new Image();
        image.addEventListener(
            "load",
            function () {
                // console.log("loaded image");
                canvas.width = image.width;
                canvas.height = image.height;
                // console.log(
                // "set canvas size: %d, %d",
                // image.width,
                // image.height
                // );
                context.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(
                    context.getImageData(0, 0, canvas.width, canvas.height)
                );
            },
            false
        );
        image.src = URI;
    });
}

const base64ToImageData = async (
    base64: string
): Promise<ImageData | undefined> => {
    if (!base64.startsWith("data:image/")) {
        base64 = "data:image/png;base64," + base64;
    }
    // console.log("base64ToImageData");
    return convertURIToImageData(base64);
};

const imageUrlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((onSuccess, onError) => {
        try {
            const reader = new FileReader();
            reader.onload = function () {
                onSuccess(this.result);
            };
            reader.readAsDataURL(blob);
        } catch (e) {
            onError(e);
        }
    });
};

function App() {
    const [label, setLabel] = React.useState("Hello World!");

    const [images, setImages] = React.useState<ImageData[]>([]);

    useEffect(() => {
        messageHandler.listenToCommand("view-image", async (data) => {
            console.log("view-image");
            setLabel(data.message);
            try {
                const imageData = await base64ToImageData(data.imageBase64);
                console.log(imageData);
                if (imageData === undefined) return;
                setImageData(imageData);
            } catch (e) {
                console.log(e);
            }
        });

        const urls = [
            "https://dummyimage.com/200x300&text=1",
            "https://dummyimage.com/200x300&text=2",
            "https://dummyimage.com/200x300&text=3",
            "https://dummyimage.com/200x300&text=3",
        ];
        const images = Promise.all(
            urls.map((url) => imageUrlToBase64(url).then(base64ToImageData))
        )
            .then((images) =>
                images.filter(
                    (image): image is ImageData => image !== undefined
                )
            )
            .then((images) =>
                setImages([
                    images[0],
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                    // ...images,
                ])
            );
    }, []);

    function handleHowdyClick() {
        vscode.postMessage({
            command: "hello",
            text: "Hey there partner! 🤠",
        });
    }

    return (
        <div className="App">
            <main className="main">
                <h1>{label}</h1>
                {/* <VSCodeButton onClick={handleHowdyClick}>Howdy!</VSCodeButton>
            <RadioButtonGroup defaultValue="b">
                <VSCodeButton value="a">A</VSCodeButton>
                <VSCodeButton value="b">B</VSCodeButton>
                <VSCodeButton value="c">C</VSCodeButton>
            </RadioButtonGroup> */}

                <ImagesGridFlow images={images}  />
            </main>
            <aside className="sidebar">
                <h2>Images</h2>
            </aside>
        </div>
    );
}

export default App;
