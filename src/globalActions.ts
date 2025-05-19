import Container from "typedi";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { DebugSession } from "./session/Session";
import { getSessionData } from "./session/SessionData";
import { WebviewClient } from "./webview/communication/WebviewClient";
import { WebviewRequests } from "./webview/communication/createMessages";

/** Utility function to refresh views, e.g. TreeView and WebView.
 *  If there's no session, it will basically clear the views.
 */
export async function refreshAllDataViews(session: DebugSession | null) {
  const watchTreeProvider = Container.get(WatchTreeProvider);
  const webviewClient = Container.get(WebviewClient);

  if (session !== null) {
    const debugSessionData = getSessionData(session);
    await debugSessionData.currentPythonObjectsList.update();
  }

  watchTreeProvider.refresh();
  webviewClient.sendRequest(WebviewRequests.replaceImages(session));
}
