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
import { FromExtensionMessageWithId } from "../webview";

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
export class HelloWorldPanel {
    public static currentPanel: HelloWorldPanel | undefined;
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

        this._webviewMessageHandler = new WebviewMessageHandler(
            this._panel.webview
        );

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
        if (HelloWorldPanel.currentPanel) {
            // If the webview panel already exists reveal it
            HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.Beside);
        } else {
            // If a webview panel does not already exist create and show a new one
            const panel = window.createWebviewPanel(
                // Panel view type
                "showHelloWorld",
                // Panel title
                "Hello World",
                // The editor column the panel should be displayed in
                ViewColumn.Beside,
                // Extra panel configurations
                {
                    // Enable JavaScript in the webview
                    enableScripts: true,
                    // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
                    localResourceRoots: [Uri.joinPath(extensionUri, "dist")],
                }
            );

            HelloWorldPanel.currentPanel = new HelloWorldPanel(
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
        HelloWorldPanel.currentPanel = undefined;

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

    /**
     * Defines and returns the HTML that should be rendered within the webview panel.
     *
     * @remarks This is also the place where references to the React webview build files
     * are created and inserted into the webview HTML.
     *
     * @param webview A reference to the extension webview
     * @param extensionUri The URI of the directory containing the extension
     * @returns A template string literal containing the HTML that should be
     * rendered within the webview panel
     */
    private _getWebviewContent(webview: Webview, extensionUri: Uri) {
        // const stylesUri = getUri(webview, extensionUri, [
        //     "dist",
        //     "webview.css",
        // ]);
        // const scriptUri = getUri(webview, extensionUri, ["dist", "webview.js"]);
        const baseUri = getUri(webview, extensionUri, ["dist"]);

        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        //     return /*html*/ `
        //   <!DOCTYPE html>
        //   <html lang="en">
        //     <head>
        //       <meta charset="UTF-8" />
        //       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        //       <meta http-equiv="Content-Security-Policy" content="default-src https:; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
        //       <link rel="stylesheet" type="text/css" href="${stylesUri}">
        //       <title>Hello World</title>
        //     </head>
        //     <body>
        //       <div id="root"></div>
        //       <div id="yew-app">Test</div>
        //       <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        //     </body>
        //   </html>
        // `;

        // <link rel="preload" nonce="${nonce}" href="${baseUri}/yew-app-987f331f08a3e6d1_bg.wasm" as="fetch" type="application/wasm" crossorigin="">
        // <link rel="modulepreload" nonce="${nonce}" href="${baseUri}/yew-app-987f331f08a3e6d1.js"></head>

        //  <script type="module" nonce="${nonce}">import init from '${baseUri}/yew-app-987f331f08a3e6d1.js';init('${baseUri}/yew-app-987f331f08a3e6d1_bg.wasm');</script>

        // return /*html*/ `
        //     <!DOCTYPE html><html><head>
        //             <meta charset="utf-8">
        //             <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        //             <meta http-equiv="Content-Security-Policy" content="default-src https: ; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' 'unsafe-eval';">
        //         <title>Yew App</title>

        //             <link rel="modulepreload" nonce="${nonce}" href="${baseUri}/webview.js"></head>
        //     <body>

        //         <div id="root"></div>
        //         <div id="yew-app">Test</div>

        //       <script type="module" nonce="${nonce}" src="${scriptUri}"></script>

        //     </body>
        //     </html>
        // `;

        // fetch index.html from dist folder
        const indexHtml = fs.readFileSync(
            path.join(extensionUri.fsPath, "dist", "index.html"),
            "utf8"
        );
        // replace script with vscode-resource URIs
        const htmlWithVscodeResourceUris = indexHtml
            .replaceAll(/\${nonce}/g, nonce)
            .replaceAll(/\${webviewCspSource}/g, webview.cspSource)
            .replaceAll(/\${baseUri}/g, baseUri.toString())
            .replace(/<script defer src="webview.js"><\/script>/g, () => {
                return `<script type="module" defer src="${baseUri}/webview.js" nonce=${nonce}></script>`;
            });
        return htmlWithVscodeResourceUris;
    }

    public postMessage(message: FromExtensionMessageWithId) {
        this._webviewMessageHandler.sendToWebview(message);
    }
}
