import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import { forwardRef, useEffect, useRef } from "react";

export const CodeTextArea = forwardRef<HTMLTextAreaElement>((props, ref) => {
    return (
        <div>
            <textarea {...props} ref={ref} />
        </div>
    );
});

function App() {
    function handleHowdyClick() {
        vscode.postMessage({
            command: "hello",
            text: "Hey there partner! 🤠",
        });
    }
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const handleKeyPressEvent = (e: KeyboardEvent) => {
            const hasCtrl = e.ctrlKey;
            // const hasAlt = e.altKey;
            const hasShift = e.shiftKey;
            const key = e.key;
            if ((hasShift || hasCtrl) && key === "Enter") {
                e.preventDefault();
                // send to vscode
            }
        };
        const element = ref.current;
        if (element === null) return;
        element.addEventListener("keypress", handleKeyPressEvent);

        return () => {
            element.removeEventListener("keypress", handleKeyPressEvent);
        };
    }, []);

    return (
        <main>
            <h1>Hello World!</h1>
            <VSCodeButton onClick={handleHowdyClick}>Howdy!</VSCodeButton>
            <CodeTextArea ref={ref} />
        </main>
    );
}

export default App;
