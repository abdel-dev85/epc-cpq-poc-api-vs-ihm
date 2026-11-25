'use strict';

/**
 * Creation d'un Product2 par le formulaire "New Product" de Vlocity Product
 * Designer. Ce n'est pas la modale Lightning standard : c'est une page
 * (Visualforce/LWC) propre a Vlocity, avec des champs additionnels (Scope,
 * Jeopardy Management...). Les selecteurs ci-dessous viennent d'une capture
 * reelle sur ce trial (Regle 3 du CLAUDE.md) : les champs standard portent un
 * attribut `name` egal au nom d'API Salesforce (`input[name="Name"]`,
 * `input[name="ProductCode"]`), un patron de `lightning-record-edit-form`
 * generique — pas invente pour cet ecran precis.
 *
 * Perimetre : seuls les champs de base (Name, ProductCode, Description).
 * Aucun page object pour les onglets ATTRIBUTE RULES / PRICING / STRUCTURE :
 * reproduire la structure complete par clics reste a capturer separement.
 */

const { config } = require('../config');
const { BasePage } = require('./base-page');

class NewProductPage extends BasePage {
  async open() {
    await this.goto('/lightning/o/Product2/new');
    await this._page.getByRole('heading', { name: 'New Product: Product' })
      .waitFor({ state: 'visible', timeout: config.navigationTimeoutMs });
  }

  async fillBase({ name, productCode, description }) {
    await this._page.locator('input[name="Name"]').fill(name);
    if (productCode) await this._page.locator('input[name="ProductCode"]').fill(productCode);
    if (description) await this._page.locator('textarea').first().fill(description);
  }

  /** Sauvegarde et rend l'Id du produit cree, deduit de l'URL de la fiche. */
  async save() {
    await this._page.getByRole('button', { name: 'Save', exact: true }).click();
    await this._page.waitForURL(/\/lightning\/r\/Product2\/[a-zA-Z0-9]{15,18}\/view/, {
      timeout: config.navigationTimeoutMs,
    });
    const match = this._page.url().match(/\/lightning\/r\/Product2\/([a-zA-Z0-9]{15,18})\/view/);
    return { productId: match ? match[1] : null, url: this._page.url() };
  }
}

module.exports = { NewProductPage };
