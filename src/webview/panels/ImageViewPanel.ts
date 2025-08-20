import type * as vscode from 'vscode';
import type { Webview, WebviewPanel } from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import _ from 'lodash';
import { Uri } from 'vscode';
import { getNonce } from '../utilities/getNonce';
import { getUri } from '../utilities/getUri';

export class ImageViewPanel {
  public static render(context: vscode.ExtensionContext, panel: WebviewPanel) {
    const extensionUri = context.extensionUri;
    panel.webview.html = ImageViewPanel._getWebviewContent(
      panel.webview,
      extensionUri,
    );
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(extensionUri, 'dist')],
    };
  }

  private static _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // generate id for the webview
    const uuid = _.uniqueId('image-view-');

    const baseUri = getUri(webview, extensionUri, ['dist']);

    const nonce = getNonce();

    // fetch index.html from dist folder
    const indexHtml = fs.readFileSync(
      path.join(extensionUri.fsPath, 'dist', 'index.html'),
      'utf8',
    );
    // replace script with vscode-resource URIs
    const htmlWithVscodeResourceUris = indexHtml
      .replaceAll(/\$\{nonce\}/g, nonce)
      .replaceAll(/\$\{webviewCspSource\}/g, webview.cspSource)
      .replaceAll(/\$\{baseUri\}/g, baseUri.toString())
      .replaceAll(/<script[^>]*?src="webview\.js"><\/script>/g, () => {
        return `<script type="module" defer src="${baseUri}/webview.js" nonce=${nonce}></script>`;
      })
      .replaceAll(/\$\{webviewUniqueId\}/g, uuid);
    return htmlWithVscodeResourceUris;
  }
}
