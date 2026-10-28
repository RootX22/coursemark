// Content scripts cannot be modules, so this one loads the module that does the work.
import((globalThis.browser ?? globalThis.chrome).runtime.getURL('content/main.js'));
