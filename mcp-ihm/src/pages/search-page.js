'use strict';

/**
 * Recherche globale Lightning.
 *
 * La barre de recherche globale est un element de chrome Salesforce present
 * depuis des annees sur tout org Lightning, pas un ecran specifique a une
 * variante EPC/CPQ : plusieurs selecteurs candidats, essayes dans l'ordre,
 * restent dans l'esprit de la Regle 3 (primitive generique) plutot qu'un
 * selecteur suppose pour un ecran produit. Si aucun ne correspond, l'erreur
 * le dit explicitement : c'est le signal qu'une capture est necessaire.
 */

const { config } = require('../config');
const { BasePage } = require('./base-page');

const SEARCH_INPUT_CANDIDATES = [
  'input[name="Search"]',
  '.slds-global-header input[type="search"]',
  'input[type="search"][aria-label]',
  '[role="searchbox"]',
];

class SearchPage extends BasePage {
  async _findSearchInput() {
    for (const selector of SEARCH_INPUT_CANDIDATES) {
      const locator = this._page.locator(selector).first();
      if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
        return locator;
      }
    }
    throw new Error(
      "Aucun des selecteurs connus de la recherche globale Lightning n'est visible sur cette page.\n"
      + 'Relevez le DOM de la barre de recherche sur cet org (page.content()) et ajoutez son '
      + 'selecteur a SEARCH_INPUT_CANDIDATES (mcp-ihm/src/pages/search-page.js) — voir Regle 3 du CLAUDE.md.'
    );
  }

  async search(term) {
    const input = await this._findSearchInput();
    await input.click();
    await input.fill(term);
    await input.press('Enter');

    await this._page.waitForURL(/\/lightning\/search\//, { timeout: config.navigationTimeoutMs }).catch(() => {});
    await this._page.waitForLoadState('networkidle', { timeout: config.navigationTimeoutMs }).catch(() => {});
  }

  async extractResults() {
    const url = this._page.url();
    const messages = await this.readMessages();
    const rows = await this.readDataLabelPairs();

    const result = { url, messages, rows };
    if (!rows.length) {
      result.visibleText = await this.readVisibleText();
      result.note = 'Aucune ligne data-label dans les resultats : texte visible rendu en filet de secours.';
    }
    return result;
  }
}

module.exports = { SearchPage };
