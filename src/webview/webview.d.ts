import { Example } from "../webview-ui/pkg/webview";

type WebviewPushCommands = {
    "view-image": {
        message: string;
        imageBase64: string;
    };
};

type XX = { e: Example }