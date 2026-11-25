'use strict';

/**
 * Cycle de vie Chromium. Repris de mcp-epc-cpq-agentic/src/browser-manager.js
 * (depot voisin) : lazy launch, mutex sur la page partagee, idle timeout,
 * reprise apres crash. Ajout propre a ce depot : le proxy EDF est passe
 * explicitement a Chromium (le trial est hors du reseau EDF direct).
 */

const { chromium } = require('playwright');

const { config } = require('./config');
const { authenticate, isSessionExpired, waitForLightningLoad } = require('./salesforce-auth');

class BrowserManager {
  constructor(options = {}) {
    this._dbg = options.dbg || (() => {});

    this._browser = null;
    this._context = null;
    this._page = null;
    this._idleTimer = null;
    this._pageLock = Promise.resolve();
  }

  async _launchBrowser() {
    this._dbg('Lancement de Chromium...');

    this._browser = await chromium.launch({
      headless: config.headless,
      args: ['--disable-gpu', '--no-sandbox'],
      proxy: config.proxyUrl ? { server: config.proxyUrl } : undefined,
    });

    this._context = await this._browser.newContext({
      baseURL: config.baseUrl,
      ignoreHTTPSErrors: config.ignoreHttpsErrors,
      viewport: { width: 1920, height: 1080 },
    });

    this._page = await this._context.newPage();
    this._dbg('Chromium lance');
  }

  async _ensureAuthenticated() {
    if (!this._browser || !this._browser.isConnected()) {
      await this._launchBrowser();
    }

    if (!this._page || this._page.isClosed()) {
      this._page = await this._context.newPage();
    }

    const url = this._page.url();
    if (url === 'about:blank' || isSessionExpired(url)) {
      this._dbg('Authentification...');
      const result = await authenticate(this._page);
      this._dbg(`Authentification terminee (reutilisee=${result.reused}, source=${result.source})`);
      this._lastAuth = result;
    }
  }

  _resetIdleTimer() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => { this.close().catch(() => {}); }, config.idleTimeoutMs);
    if (typeof this._idleTimer.unref === 'function') this._idleTimer.unref();
  }

  /** Serialise tout acces a la page partagee. */
  async withPage(fn) {
    const previous = this._pageLock;
    let release;
    this._pageLock = new Promise(resolve => { release = resolve; });
    await previous;

    try {
      this._resetIdleTimer();
      await this._ensureAuthenticated();
      return await fn(this._page);
    } finally {
      this._resetIdleTimer();
      release();
    }
  }

  async screenshot(navigateTo) {
    return this.withPage(async (page) => {
      if (navigateTo) {
        await page.goto(navigateTo, {
          waitUntil: 'domcontentloaded',
          timeout: config.navigationTimeoutMs,
        });
        await waitForLightningLoad(page).catch(() => {});
      }
      const buffer = await page.screenshot({ fullPage: true });
      return buffer.toString('base64');
    });
  }

  async close() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._browser) {
      this._dbg('Fermeture du navigateur');
      await this._browser.close().catch(() => {});
      this._browser = null;
      this._context = null;
      this._page = null;
    }
  }

  get isRunning() {
    return this._browser !== null && this._browser.isConnected();
  }

  get currentUrl() {
    return this._page && !this._page.isClosed() ? this._page.url() : null;
  }

  get lastAuth() {
    return this._lastAuth || null;
  }
}

module.exports = { BrowserManager };
