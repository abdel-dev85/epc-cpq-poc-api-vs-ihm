'use strict';

/**
 * Session Salesforce dans le navigateur, mode sf-cli uniquement.
 *
 * Repris de mcp-epc-cpq-agentic/src/salesforce-auth.js (depot voisin),
 * simplifie : pas de mode Gardian ici, le trial n'a pas de SSO EDF (voir
 * docs/decisions.md).
 *
 * Cache : `.auth/<hote-de-l-org>.json` (storageState Playwright), tente en
 * premier et re-valide reellement (home Lightning chargee, header exige).
 */

const fs = require('fs');
const path = require('path');

const { config } = require('./config');

/** Pages que Salesforce intercale sans prevenir : passkey, MFA, verification. */
const INTERSTITIAL_PATTERNS = [
  '/identity/webauthn/',
  '/AddPasskeyUi',
  '/identity/verification/',
  '/setup/secur/',
  '/twofactor/',
];

const HEADER_SELECTOR = '.slds-global-header, .oneGlobalNav';

function isSessionExpired(url) {
  return (
    url.includes('/login')
    || url.includes('/secur/logout')
    || url.includes('login.salesforce.com')
  );
}

function isInterstitialPage(url) {
  return INTERSTITIAL_PATTERNS.some(pattern => url.includes(pattern));
}

async function waitForLightningLoad(page) {
  const home = `${config.baseUrl}/lightning/page/home`;
  const goHome = () => page.goto(home, {
    waitUntil: 'domcontentloaded',
    timeout: config.navigationTimeoutMs,
  });

  if (isInterstitialPage(page.url()) || !page.url().includes('lightning.force.com')) {
    await goHome();
  }
  if (isInterstitialPage(page.url())) {
    await goHome();
  }

  await page.waitForSelector(HEADER_SELECTOR, {
    state: 'attached',
    timeout: config.navigationTimeoutMs,
  });
}

async function headerIsVisible(page, timeout) {
  return page.locator(HEADER_SELECTOR)
    .first()
    .isVisible({ timeout })
    .catch(() => false);
}

async function tryExistingSession(page) {
  if (!fs.existsSync(config.authStatePath)) return false;

  try {
    const state = JSON.parse(fs.readFileSync(config.authStatePath, 'utf-8'));
    if (Array.isArray(state.cookies) && state.cookies.length) {
      await page.context().addCookies(state.cookies);
    }

    await page.goto(`${config.baseUrl}/lightning/page/home`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    await page.waitForURL(/.*lightning\.force\.com.*/, { timeout: 15_000 });

    if (!await headerIsVisible(page, 15_000)) return false;
    if (isSessionExpired(page.url())) return false;
    if (isInterstitialPage(page.url())) return false;

    return true;
  } catch {
    return false;
  }
}

async function authenticateWithSfCli(page) {
  const { getFrontdoorUrl } = require('./auth/sf-cli');

  if (!config.baseUrl) {
    throw new Error(
      'SF_BASE_URL non renseigne dans .env.\n'
      + 'Lisez-le avec : sf org display --target-org ' + config.sfCliOrg + ' --json\n'
      + "(remplacer .my.salesforce.com par .lightning.force.com dans instanceUrl)."
    );
  }

  await page.goto(getFrontdoorUrl(), {
    waitUntil: 'domcontentloaded',
    timeout: config.navigationTimeoutMs,
  });

  await waitForLightningLoad(page);

  if (!await headerIsVisible(page, 30_000)) {
    throw new Error(
      "Lightning ne s'est pas charge apres ouverture du frontdoor.\n"
      + `URL de la page : ${page.url()}\n`
      + `Verifiez que SF_BASE_URL correspond bien a l'org "${config.sfCliOrg}".\n`
      + `Relancez au besoin : ${config.sfCliLoginCommand}`
    );
  }

  return { reused: false, source: 'sf-cli-frontdoor' };
}

async function authenticate(page) {
  fs.mkdirSync(path.dirname(config.authStatePath), { recursive: true });

  if (await tryExistingSession(page)) {
    await page.context().storageState({ path: config.authStatePath });
    return { reused: true, source: 'playwright-cache' };
  }

  const result = await authenticateWithSfCli(page);
  await page.context().storageState({ path: config.authStatePath });
  return result;
}

module.exports = {
  isSessionExpired,
  isInterstitialPage,
  waitForLightningLoad,
  tryExistingSession,
  authenticate,
};
