'use strict';

/**
 * Primitives communes, reprises de mcp-epc-cpq-agentic/src/pages/base-page.js
 * (depot voisin) et deja eprouvees sur un org Lightning reel : lecture des
 * messages/bandeaux et traversee du shadow DOM. Voir Regle 3 du CLAUDE.md de
 * ce depot : ces primitives sont generiques (chrome Lightning, pas un ecran
 * specifique a une variante EPC/CPQ) et se reprennent sans nouvelle capture ;
 * un page object specifique a un ecran du trial, lui, en demanderait une.
 */

const { config } = require('../config');

const SHADOW_HELPERS = `
  function deepQueryAll(root, selector, out) {
    out = out || [];
    if (!root) return out;
    if (root.querySelectorAll) {
      for (const el of root.querySelectorAll(selector)) out.push(el);
    }
    const walker = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of walker) {
      if (el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out);
    }
    return out;
  }
  function clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }
`;

class BasePage {
  constructor(page) {
    this._page = page;
  }

  get page() {
    return this._page;
  }

  async goto(relativePath) {
    await this._page.goto(relativePath, {
      waitUntil: 'domcontentloaded',
      timeout: config.navigationTimeoutMs,
    });
  }

  /** Messages affiches a l'ecran : bandeaux d'alerte, erreurs, avertissements. */
  async readMessages() {
    const raw = await this._page.evaluate(`(() => {
      ${SHADOW_HELPERS}
      const seen = new Set();
      const out = [];
      const selectors = [
        'div[role="alert"]',
        '.slds-notify',
        '.slds-scoped-notification',
        'records-record-banner',
      ];
      for (const sel of selectors) {
        for (const el of deepQueryAll(document, sel)) {
          const text = clean(el.innerText);
          if (!text || seen.has(text)) continue;
          seen.add(text);
          out.push({ text: text.slice(0, 400), selector: sel });
        }
      }
      return out;
    })()`);

    return raw.filter(m => !/^(chargement|loading)\b/i.test(m.text));
  }

  /**
   * Paires label/valeur portees par l'attribut generique `data-label`
   * (datatables Lightning : vues de liste, listes associees, resultats de
   * recherche). Rend un tableau vide si l'ecran courant n'utilise pas ce
   * patron — ce n'est pas une erreur, c'est une information.
   */
  async readDataLabelPairs(maxRows = 200) {
    return this._page.evaluate(`((maxRows) => {
      ${SHADOW_HELPERS}
      const rows = deepQueryAll(document, 'tr');
      const out = [];
      for (const tr of rows.slice(0, maxRows)) {
        const fields = {};
        for (const cell of deepQueryAll(tr, '[data-label]')) {
          const label = clean(cell.getAttribute('data-label'));
          if (!label) continue;
          fields[label] = clean(cell.innerText);
        }
        if (Object.keys(fields).length) out.push(fields);
      }
      return out;
    })(${Number(maxRows)})`);
  }

  /** Texte visible de la page entiere, tronque. Filet de secours quand aucun patron connu ne correspond. */
  async readVisibleText(maxChars = 8000) {
    const text = await this._page.evaluate(() => document.body.innerText || '');
    return text.replace(/\n{3,}/g, '\n\n').trim().slice(0, maxChars);
  }

  async dismissModals() {
    const closers = this._page.locator(
      'button.slds-modal__close, button[title="Close"], button[title="Fermer"]'
    );
    const count = await closers.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      await closers.nth(i).click({ timeout: 2000 }).catch(() => {});
    }
  }
}

module.exports = { BasePage, SHADOW_HELPERS };
