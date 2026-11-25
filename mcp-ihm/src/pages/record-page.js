'use strict';

/**
 * Fiche d'enregistrement Lightning, lecture generique.
 *
 * Volontairement sans page object specifique a un ecran EPC/CPQ (Regle 3 du
 * CLAUDE.md de ce depot : un tel page object attend une capture reelle sur
 * le trial). Ce qui est lu ici est generique a toute fiche Lightning :
 *   - le titre de la page (convention Salesforce : "<Nom> | <Objet>") ;
 *   - les messages/bandeaux (primitive deja eprouvee) ;
 *   - les paires data-label (listes associees rendues en datatable) ;
 *   - a defaut, le texte visible entier, comme filet de secours honnete
 *     plutot qu'un champ suppose a un endroit devine.
 */

const { config } = require('../config');
const { BasePage } = require('./base-page');

const HEADER_SELECTOR = '.slds-global-header, .oneGlobalNav';

class RecordPage extends BasePage {
  /** Ouvre par Id (deduit le chemin standard) ou par chemin relatif explicite. */
  async open(idOrPath) {
    const path = /^[a-zA-Z0-9]{15,18}$/.test(idOrPath)
      ? `/lightning/r/${idOrPath}/view`
      : idOrPath;

    await this.goto(path);

    await this._page.waitForSelector(HEADER_SELECTOR, {
      state: 'attached',
      timeout: config.navigationTimeoutMs,
    });

    // Condition observable, pas une duree : le reseau redevient silencieux
    // une fois les appels Lightning (layout, listes associees) retombes.
    await this._page.waitForLoadState('networkidle', { timeout: config.navigationTimeoutMs }).catch(() => {});
  }

  async extractData() {
    const url = this._page.url();
    const title = (await this._page.title()).trim();
    const messages = await this.readMessages();
    const dataLabelRows = await this.readDataLabelPairs();

    const result = { url, title, messages, dataLabelRows };

    if (!dataLabelRows.length) {
      result.visibleText = await this.readVisibleText();
      result.note = "Aucune ligne data-label trouvee sur cet ecran : texte visible rendu en filet de secours. "
        + 'Un page object specifique a cet ecran demande une capture reelle (Regle 3 du CLAUDE.md).';
    }

    return result;
  }
}

module.exports = { RecordPage };
