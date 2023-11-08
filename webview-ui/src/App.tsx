import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import RadioButtonGroup from "./components/RadioButtonGroup";

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
    return (
        <main>
            <h1>Hello World!</h1>
            <VSCodeButton onClick={handleHowdyClick}>Howdy!</VSCodeButton>
            <RadioButtonGroup options={["a", "b", "c", "d"]} defaultValue="b" />
        </main>
    );
}

export default App;
