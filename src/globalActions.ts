import type { Option } from 'ts-results';
import type { DebugSession } from './session/Session';
import Container from 'typedi';
import { WatchTreeProvider } from './image-watch-tree/WatchTreeProvider';
import { getSessionData } from './session/SessionData';
import { WebviewRequests } from './webview/communication/createMessages';
import { GlobalWebviewClient } from './webview/communication/WebviewClient';

/**
 * Utility function to refresh views, e.g. TreeView and WebView.
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
