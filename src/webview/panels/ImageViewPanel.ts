import * as vscode from "vscode";
import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
} from "vscode";
import * as fs from "fs";
import * as path from "path";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
// import * as sharp from "sharp";
import { WebviewMessageHandler } from "./WebviewMessageHandler";
import Container from "typedi";
import { WebviewClient } from "../communication/WebviewClient";
import { logInfo } from "../../Logging";

/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class ImageViewPanel {
    public static currentPanel: ImageViewPanel | undefined;
    private readonly _panel: WebviewPanel;
    private _disposables: Disposable[] = [];

    private _webviewMessageHandler: WebviewMessageHandler;

    /**
     * The HelloWorldPanel class private constructor (called only from the render method).
     *
     * @param panel A reference to the webview panel
     * @param extensionUri The URI of the directory containing the extension
     */
    private constructor(
        panel: WebviewPanel,
        extensionUri: Uri,
        context: vscode.ExtensionContext
    ) {
        this._panel = panel;

        // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
        // the panel or when the panel is closed programmatically)
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Set the HTML content for the webview panel
        this._panel.webview.html = this._getWebviewContent(
            this._panel.webview,
            extensionUri
        );

        this._webviewMessageHandler = new WebviewMessageHandler();
        Container.get(WebviewClient).setWebview(this._panel.webview);

        // Set an event listener to listen for messages passed from the webview context
        // this._setWebviewMessageListener(this._panel.webview, context);
        this._panel.webview.onDidReceiveMessage(
            this._webviewMessageHandler.onWebviewMessage,
            this._webviewMessageHandler,
            context.subscriptions
        );
    }

    /**
     * Renders the current webview panel if it exists otherwise a new webview panel
     * will be created and displayed.
     *
     * @param extensionUri The URI of the directory containing the extension.
     */
    public static render(context: vscode.ExtensionContext) {
        const extensionUri = context.extensionUri;
        if (ImageViewPanel.currentPanel) {
            ImageViewPanel.currentPanel._panel.reveal(ViewColumn.Beside);
        } else {
            const panel = window.createWebviewPanel(
                "image-view",
                "Image View",
                ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [Uri.joinPath(extensionUri, "dist")],
                }
            );

            ImageViewPanel.currentPanel = new ImageViewPanel(
                panel,
                extensionUri,
                context
            );
        }
    }

    /**
     * Cleans up and disposes of webview resources when the webview panel is closed.
     */
    public dispose() {
        ImageViewPanel.currentPanel = undefined;

        Container.get(WebviewClient).unsetWebview();

        // Dispose of the current webview panel
        this._panel.dispose();

        // Dispose of all disposables (i.e. commands) for the current webview panel
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        const baseUri = getUri(webview, extensionUri, ["dist"]);

        const nonce = getNonce();

        // fetch index.html from dist folder
        const indexHtml = fs.readFileSync(
            path.join(extensionUri.fsPath, "dist", "index.html"),
            "utf8"
        );
        logInfo("indexHtml", indexHtml);
        // replace script with vscode-resource URIs
        const htmlWithVscodeResourceUris = indexHtml
            .replaceAll(/\${nonce}/g, nonce)
            .replaceAll(/\${webviewCspSource}/g, webview.cspSource)
            .replaceAll(/\${baseUri}/g, baseUri.toString())
            .replaceAll(/<script[^>]*?src="webview\.js"><\/script>/g, () => {
                return `<script type="module" defer src="${baseUri}/webview.js" nonce=${nonce}></script>`;
            })
            ;
        logInfo("htmlWithVscodeResourceUris", htmlWithVscodeResourceUris);
        return htmlWithVscodeResourceUris;
    }
}
