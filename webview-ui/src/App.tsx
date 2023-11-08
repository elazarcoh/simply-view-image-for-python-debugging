import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import RadioButtonGroup from "./components/RadioButtonGroup";
import SelectableImage from "./components/SelectableImage";

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

function App() {
    function handleHowdyClick() {
        vscode.postMessage({
            command: "hello",
            text: "Hey there partner! 🤠",
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
    const getImage = (text: string) =>
        imageUrlToBase64(`https://dummyimage.com/200x300&text=${text}`);
    return (
        <main>
            <h1>Hello World!</h1>
            <VSCodeButton onClick={handleHowdyClick}>Howdy!</VSCodeButton>
            <RadioButtonGroup options={["a", "b", "c", "d"]} defaultValue="b" />
            <SelectableImage
                names={["a", "b", "c", "d"]}
                imageDataBase64ByName={getImage}
            />
        </main>
    );
}

export default App;
