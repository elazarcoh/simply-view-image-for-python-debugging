import Container from "typedi";
import { WatchTreeProvider } from "./image-watch-tree/WatchTreeProvider";
import { DebugSession } from "./session/Session";
import { getSessionData } from "./session/SessionData";
import { GlobalWebviewClient } from "./webview/communication/WebviewClient";
import { WebviewRequests } from "./webview/communication/createMessages";
import { Option } from "ts-results";

/** Utility function to refresh views, e.g. TreeView and WebView.
 *  If there's no session, it will basically clear the views.
 */
export async function refreshAllDataViews(session: Option<DebugSession>) {
  const watchTreeProvider = Container.get(WatchTreeProvider);
  const webviewClient = Container.get(GlobalWebviewClient);

  if (session.some) {
    const debugSessionData = getSessionData(session.val);
    await debugSessionData.currentPythonObjectsList.update();
  }

  watchTreeProvider.refresh();
  webviewClient.sendRequest(WebviewRequests.replaceImages(session));
}
