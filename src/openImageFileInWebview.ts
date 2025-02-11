import * as vscode from "vscode";
import { EXTENSION_CUSTOM_EDITOR_ID } from "./globals";
import { WebviewClient } from "./webview/communication/WebviewClient";
import Container from "typedi";
import { ImageViewPanel } from "./webview/panels/ImageViewPanel";

export class ImagePreviewCustomEditor
    implements vscode.CustomReadonlyEditorProvider
{
    public static readonly viewType = EXTENSION_CUSTOM_EDITOR_ID;

    constructor(private readonly context: vscode.ExtensionContext) {}


    public async openCustomDocument(uri: vscode.Uri) {
        return { uri, dispose: () => {} };
    }

    public async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewEditor: vscode.WebviewPanel,
    ): Promise<void> {
        console.log("resolveCustomEditor", document.uri.toString());
        ImageViewPanel.render(this.context, webviewEditor);
    }
}
