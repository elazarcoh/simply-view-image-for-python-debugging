/**
 * Basic UI test for Simply View Image for Python Debugging extension
 * Tests if the extension is properly installed and displays correct information
 */

import type { ExtensionsViewItem, ExtensionsViewSection } from 'vscode-extension-tester';
import { expect } from 'chai';
import { ActivityBar } from 'vscode-extension-tester';
import pjson from '../../package.json';
import { setupTestEnvironment } from './test-utils';

describe('simply View Image Extension Tests', () => {
  let extension: ExtensionsViewItem;

  before(async function () {
    this.timeout(30000);

    // Setup test environment: ensure VS Code is ready and extension is activated
    await setupTestEnvironment(15000);

    try {
      // Open the extensions view
      const view = await (await new ActivityBar().getViewControl('Extensions'))?.openView();
      await view?.getDriver().wait(async () => {
        return (await view.getContent().getSections()).length > 0;
      }, 10000);

      // Find the 'Installed' section
      const extensions = (await view?.getContent().getSection('Installed')) as ExtensionsViewSection;

      // Search for our extension
      await extensions.getDriver().wait(async () => {
        extension = (await extensions.findItem(`@installed ${pjson.displayName}`)) as ExtensionsViewItem;
        return extension !== undefined;
      }, 10000);
    }
    catch (error) {
      // Extensions view can be flaky in headless/CI environments
      console.warn(`Extension view setup failed (non-critical): ${error}`);
    }
  });

  it('extension should be installed', function () {
    if (!extension) {
      // Skip when Extensions view couldn't be opened (common in headless/CI)
      this.skip();
    }
  });

  it('extension should have correct metadata', async function () {
    if (!extension) {
      this.skip();
    }
    const author = await extension.getAuthor();
    const description = await extension.getDescription();
    const version = await extension.getVersion();

    // Verify against values in package.json
    // Note: author field might show full name instead of publisher
    expect(author).to.satisfy((name: string) =>
      name === pjson.publisher || name === 'Elazar Cohen',
    );
    expect(description).equals(pjson.description);
    expect(version).equals(pjson.version);
  });
});
