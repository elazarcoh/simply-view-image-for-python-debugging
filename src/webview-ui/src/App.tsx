import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import RadioButtonGroup from "./components/RadioButtonGroup";
import SelectableImage from "./components/SelectableImage";
import React, { useEffect } from "react";
import { Messenger } from "../../utils/Messenger";
import { MessageHandlerData } from "../../utils/MessageHandlerData";
import { messageHandler } from "../../utils/MessageHandler";

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
const BASE64_MARKER = ";base64,";

const actions: { [command: string]: (data: any) => void } = {};


window.addEventListener("message", (event) => {
    actions[event.data.command](event.data);
});

function convertDataURIToBinary(dataURI: string) {
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8ClampedArray(new ArrayBuffer(rawLength));

    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

function App() {
    const [label, setLabel] = React.useState("Hello World!");

    useEffect(() => {
        actions["hello"] = (data: unknown) => {
            setLabel(data.text);
            console.log(data.imageData);
        };
    }, []);

    const [imageData, setImageData] = React.useState<ImageData | null>(null);

    function handleHowdyClick() {
        vscode.postMessage({
            command: "hello",
            text: "Hey there partner! 🤠",
            imageData: imageData,
        });
    }
    const imageUrlToBase64 = async (
        url: string
    ): Promise<`data:image/${string};base64${string}`> => {
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
    function convertURIToImageData(URI: string): Promise<ImageData> {
        return new Promise(function (resolve, reject) {
            if (URI == null) return reject();
            console.log(URI);
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            if (context === null) return reject();
            const image = new Image();
            image.addEventListener(
                "load",
                function () {
                    canvas.width = image.width;
                    canvas.height = image.height;
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
    const base64ToBuffer = async (
        base64: `data:image/${string};base64${string}`
    ) => {
        const uri = base64.split(";base64,").pop();
        const imgBuffer = Buffer.from(uri!, "base64");
        return imgBuffer;
    };
    const bufferToImageData = async (buffer: Buffer) => {
        const blob = new Blob([buffer], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const imageData = ctx?.getImageData(0, 0, img.width, img.height);
        return imageData;
    };

    const getImage = (text: string) =>
        imageUrlToBase64(`https://dummyimage.com/200x300&text=${text}`)
            .then(convertURIToImageData)
            .then((imageData) => {
                setImageData(imageData);
                return imageData;
            });
    return (
        <main>
            <h1>{label}</h1>
            <VSCodeButton onClick={handleHowdyClick}>Howdy!</VSCodeButton>
            <RadioButtonGroup defaultValue="b">
                <VSCodeButton value="a">A</VSCodeButton>
                <VSCodeButton value="b">B</VSCodeButton>
                <VSCodeButton value="c">C</VSCodeButton>
            </RadioButtonGroup>
            <SelectableImage
                names={["a", "b", "c", "d"]}
                imageDataByName={getImage}
            />
        </main>
    );
}

export default App;
