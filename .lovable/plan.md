## Somossa
Extension install/reload korar por, jodio manifest e `content_scripts` diye `<all_urls>` match kora ache, Chrome sudhu **notun load howa page** e content script inject kore. Age theke khola tab gulote script auto-inject hoy na — tai user ke manually refresh dite hocche.

## Solution
Install / update / browser startup er shomoy background service worker theke **chrome.scripting API** diye shob compatible already-open tab e content script programmatically inject kore dewa hobe. Tokhon refresh chara-i kaj korbe.

## Changes

### 1. `extension/manifest.json`
- `permissions` array e `"scripting"` add kora.
- `host_permissions: ["<all_urls>"]` add kora (scripting.executeScript er jonno lage).

### 2. `extension/background/service-worker.js`
- Notun helper `injectIntoAllTabs()`:
  - `chrome.tabs.query({})` diye shob tab ana.
  - Prottek tab er URL check kore (chrome://, edge://, chrome-webstore, about:, view-source: bad dewa — oi guloy inject kora jay na, error dey).
  - `chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ["content/content.js"] })` chalano, try/catch e wrap kore (permission-denied tab silently skip).
- Call kora hobe:
  - `chrome.runtime.onInstalled` handler er moddhe (install ebong update duitatei).
  - `chrome.runtime.onStartup` listener add kore.
- Duplicate inject theke bachate content.js er top e ekta guard already ache ki na dekhe, na thakle `if (window.__SE_BANGLISH_INJECTED__) { /* skip */ } window.__SE_BANGLISH_INJECTED__ = true;` add kora hobe — jate manifest auto-inject + programmatic inject ekshathe holeo double listener na hoy.

### 3. Repackage
- `public/se-banglish-avro.zip` rebuild kora hobe notun manifest + service worker + content script niye.

## Result
Extension install/update er por Gmail, FB, ChatGPT — shob already-open tab e refresh chara-i typing kaj korbe. Notun tab er behavior aager motoi thakbe.
