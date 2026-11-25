'use strict';

/**
 * Vue de liste Lightning (`/lightning/o/<Objet>/list`), reprise de
 * mcp-epc-cpq-agentic/src/pages/list-view-page.js (depot voisin), ou le
 * patron (cellules `[data-label]` dans le shadow DOM, compteur plafonne a
 * « 50+ », lien de fiche dans un shadow root imbrique) a ete constate et
 * valide sur un org Lightning reel.
 *
 * Utilisee ici comme parcours de "recherche" cote IHM : la recherche globale
 * de ce trial ouvre sur une page d'accueil specifique au trial (splash
 * d'onboarding, pas la recherche globale Lightning standard) — voir le
 * constat dans docs/decisions.md. Parcourir la vue de liste et filtrer par
 * nom est un parcours tout aussi realiste pour retrouver un produit dans un
 * catalogue, et s'appuie sur une primitive deja eprouvee plutot que sur un
 * selecteur devine pour cet ecran d'accueil (Regle 3 du CLAUDE.md).
 */

const { config } = require('../config');
const { BasePage, SHADOW_HELPERS } = require('./base-page');

const DEFAULT_MAX_ROWS = 200;
const GRID_GRACE_MS = 12_000;

class ListViewPage extends BasePage {
  async open(objectApiName, listView) {
    const suffix = listView ? `?filterName=${encodeURIComponent(listView)}` : '';
    await this.goto(`/lightning/o/${objectApiName}/list${suffix}`);

    const grid = this._page.getByRole('grid').first();
    const counter = this._page.locator('[class*="countSortedByFilteredBy"]').first();

    const attached = (locator, timeout) => locator
      .waitFor({ state: 'attached', timeout })
      .then(() => true)
      .catch(() => false);

    await Promise.race([
      attached(grid, config.navigationTimeoutMs),
      attached(counter, config.navigationTimeoutMs),
    ]);

    if (!await attached(grid, GRID_GRACE_MS)) return;
    await attached(this._page.getByRole('row').nth(1), GRID_GRACE_MS);
  }

  async _loadMoreRows(maxRows) {
    const rows = this._page.getByRole('row');
    let previous = -1;

    for (let pass = 0; pass < 30; pass++) {
      const current = await rows.count();
      if (current - 1 >= maxRows) break;
      if (current === previous) break;
      previous = current;

      await rows.last().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

      await this._page
        .waitForFunction(
          (before) => {
            const deep = (root, out) => {
              if (!root.querySelectorAll) return out;
              for (const r of root.querySelectorAll('tbody tr')) out.push(r);
              for (const el of root.querySelectorAll('*')) {
                if (el.shadowRoot) deep(el.shadowRoot, out);
              }
              return out;
            };
            return deep(document, []).length > before;
          },
          current - 1,
          { timeout: 8000 }
        )
        .catch(() => {});
    }
  }

  static parseCountLabel(label) {
    const none = { announced: null, atLeast: false };
    if (!label) return none;
    const match = String(label).match(/^[^0-9]*([0-9][0-9   ,.]*)(\+)?/);
    if (!match) return none;
    const digits = match[1].replace(/[^0-9]/g, '');
    if (!digits) return none;
    return { announced: parseInt(digits, 10), atLeast: Boolean(match[2]) };
  }

  async extractData({ maxRows = DEFAULT_MAX_ROWS } = {}) {
    await this._loadMoreRows(maxRows);

    const extracted = await this._page.evaluate(`((maxRows) => {
      ${SHADOW_HELPERS}

      const grid = deepQueryFirst(document, 'table[role="grid"]') || deepQueryFirst(document, 'table');
      if (!grid) return { grid: false };

      const bodyRows = deepQueryAll(grid, 'tbody tr');

      const columns = [];
      const seenCols = new Set();
      for (const cell of deepQueryAll(bodyRows[0] || grid, '[data-label]')) {
        const label = clean(cell.getAttribute('data-label'));
        if (!label || seenCols.has(label)) continue;
        seenCols.add(label);
        columns.push(label);
      }

      const rows = [];
      for (const tr of bodyRows.slice(0, maxRows)) {
        const fields = {};
        for (const cell of deepQueryAll(tr, '[data-label]')) {
          const label = clean(cell.getAttribute('data-label'));
          if (!label) continue;
          fields[label] = clean(cell.innerText);
        }
        if (!Object.keys(fields).length) continue;

        const link = deepQueryFirst(tr, 'a[href]');
        const href = link ? link.getAttribute('href') : null;
        const match = href ? href.match(/\\/lightning\\/r\\/(?:[^/]+\\/)?([a-zA-Z0-9]{15,18})\\//) : null;

        rows.push({ fields, recordId: match ? match[1] : null, href });
      }

      const countEl = deepQueryFirst(document, '[class*="countSortedByFilteredBy"]');

      return {
        grid: true,
        columns,
        rows,
        totalRowsInDom: bodyRows.length,
        countLabel: countEl ? clean(countEl.innerText) : null,
      };
    })(${Number(maxRows)})`);

    const messages = await this.readMessages();
    const url = this._page.url();
    const viewName = (await this._page.title()).split('|')[0].trim() || null;

    if (!extracted.grid) {
      return { url, viewName, columns: [], rows: [], rowCount: 0, countLabel: null, truncated: false, empty: true, messages };
    }

    const count = ListViewPage.parseCountLabel(extracted.countLabel);
    const returned = extracted.rows.length;

    const truncated = extracted.totalRowsInDom > returned
      || (count.announced !== null && (count.atLeast ? returned <= count.announced : returned < count.announced));

    return {
      url,
      viewName,
      columns: extracted.columns,
      rows: extracted.rows,
      rowCount: returned,
      countLabel: extracted.countLabel,
      countAnnounced: count.announced,
      countIsAtLeast: count.atLeast,
      truncated,
      empty: returned === 0,
      messages,
    };
  }
}

module.exports = { ListViewPage, DEFAULT_MAX_ROWS };
