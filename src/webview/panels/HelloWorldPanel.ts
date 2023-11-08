import * as vscode from "vscode";
import {
    Disposable,
    Webview,
    WebviewPanel,
    window,
    Uri,
    ViewColumn,
} from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
// import * as sharp from "sharp";
import { MessageHandlerData } from "../../utils/MessageHandlerData";

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

        // Set an event listener to listen for messages passed from the webview context
        this._setWebviewMessageListener(this._panel.webview, context);
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
            HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.One);
        } else {
            // If a webview panel does not already exist create and show a new one
            const panel = window.createWebviewPanel(
                // Panel view type
                "showHelloWorld",
                // Panel title
                "Hello World",
                // The editor column the panel should be displayed in
                ViewColumn.One,
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
        const stylesUri = getUri(webview, extensionUri, [
            "dist",
            "webview.css",
        ]);
        const scriptUri = getUri(webview, extensionUri, ["dist", "webview.js"]);

        const nonce = getNonce();

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src https:; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="root"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
    }

    /**
     * Sets up an event listener to listen for messages passed from the webview context and
     * executes code based on the message that is recieved.
     *
     * @param webview A reference to the extension webview
     * @param context A reference to the extension context
     */
    private _setWebviewMessageListener(
        webview: Webview,
        context: vscode.ExtensionContext
    ) {
        webview.onDidReceiveMessage(
            (message) => {
                const { command, requestId, payload } = message;

                if (command === "<command id>") {
                    // Do something with the payload
                    console.log(payload);

                    // Send a response back to the webview
                    webview.postMessage({
                        command,
                        requestId, // The requestId is used to identify the response
                        payload: `Hello from the extension!`,
                    } as MessageHandlerData<string>);
                }
            },
            undefined,
            context.subscriptions
        );

        //     webview.onDidReceiveMessage(
        //         (message: unknown) => {
        //             if (
        //                 typeof message !== "object" ||
        //                 message === null ||
        //                 !("command" in message) ||
        //                 !("text" in message)
        //             ) {
        //                 return;
        //             }
        //             const command = message.command;
        //             const text = message.text as string;

        //             switch (command) {
        //                 case "hello":
        //                     // Code that should run in response to the hello message command
        //                     window.showInformationMessage(text);
        //                     return;
        //                 // Add more switch case statements here as more webview message commands
        //                 // are created within the webview context (i.e. inside media/main.js)
        //             }
        //         },
        //         undefined,
        //         this._disposables
        //     );
        // }
    }

    public postMessage(message: unknown) {
        this._panel.webview.postMessage(message);
    }
}