'use strict';

/**
 * Creation d'une variante de produit par API, en reprenant la structure
 * commerciale d'un produit source (categorie, attributs, tarification,
 * composants de bundle) sur l'objet model Vlocity CMT constate sur ce trial
 * (voir blueprint.js et docs/architecture.md).
 *
 * Perimetre autorise par docs/decisions.md (mutation cadree, 2026-11-25) :
 * un produit, suffixe, et ses rattachements directs — rien d'autre. Chaque
 * ecriture est tracee ; a la fin, tout est relu par SOQL pour constater ce
 * qui existe reellement, pas seulement ce que Salesforce a repondu "success".
 */

const { sobjectCreate, query } = require('./sf-rest-client');
const { resolveProduct } = require('./blueprint');

async function tryCreate(trace, step, objectName, fields) {
  try {
    const r = await sobjectCreate(objectName, fields);
    trace.push({ step, objet: objectName, id: r.id });
    return r.id;
  } catch (err) {
    trace.push({ step, objet: objectName, erreur: err.message });
    return null;
  }
}

async function createApiVariant(sourceIdOrName, suffix = '_POC_API') {
  const source = await resolveProduct(sourceIdOrName);
  const trace = [];

  const newId = await tryCreate(trace, 'produit', 'Product2', {
    Name: `${source.Name}${suffix}`,
    ProductCode: `${source.ProductCode || ''}${suffix}`,
    Description: `${source.Description || ''} (cree par API a partir de ${source.Name}, ${source.Id})`.trim(),
    Family: source.Family,
    IsActive: true,
  });

  if (!newId) {
    return { sourceId: source.Id, sourceName: source.Name, newProductId: null, trace, verified: null };
  }

  const categories = await query(
    `SELECT vlocity_cmt__CatalogId__c FROM vlocity_cmt__CatalogProductRelationship__c WHERE vlocity_cmt__Product2Id__c = '${source.Id}'`
  );
  for (const cat of categories.records) {
    await tryCreate(trace, 'categorie', 'vlocity_cmt__CatalogProductRelationship__c', {
      vlocity_cmt__CatalogId__c: cat.vlocity_cmt__CatalogId__c,
      vlocity_cmt__Product2Id__c: newId,
    });
  }

  const attrs = await query(
    `SELECT vlocity_cmt__AttributeId__c, vlocity_cmt__AttributeId__r.vlocity_cmt__Code__c, vlocity_cmt__AttributeCategoryId__c
     FROM vlocity_cmt__AttributeAssignment__c WHERE vlocity_cmt__ObjectId__c = '${source.Id}'`
  );
  for (const a of attrs.records) {
    const code = a.vlocity_cmt__AttributeId__r ? a.vlocity_cmt__AttributeId__r.vlocity_cmt__Code__c : 'ATTR';
    await tryCreate(trace, 'attribut', 'vlocity_cmt__AttributeAssignment__c', {
      Name: `CLONED_${newId}_${code}`,
      vlocity_cmt__ObjectId__c: newId,
      vlocity_cmt__AttributeId__c: a.vlocity_cmt__AttributeId__c,
      vlocity_cmt__AttributeCategoryId__c: a.vlocity_cmt__AttributeCategoryId__c,
    });
  }

  const priceEntries = await query(
    `SELECT vlocity_cmt__PriceListId__c, vlocity_cmt__IsBasePrice__c FROM vlocity_cmt__PriceListEntry__c WHERE vlocity_cmt__ProductId__c = '${source.Id}'`
  );
  for (const p of priceEntries.records) {
    await tryCreate(trace, 'tarification-vlocity', 'vlocity_cmt__PriceListEntry__c', {
      vlocity_cmt__PriceListId__c: p.vlocity_cmt__PriceListId__c,
      vlocity_cmt__ProductId__c: newId,
      vlocity_cmt__IsBasePrice__c: p.vlocity_cmt__IsBasePrice__c,
    });
  }

  const pbEntries = await query(`SELECT Pricebook2Id, UnitPrice FROM PricebookEntry WHERE Product2Id = '${source.Id}'`);
  for (const pb of pbEntries.records) {
    await tryCreate(trace, 'tarification-standard', 'PricebookEntry', {
      Pricebook2Id: pb.Pricebook2Id,
      Product2Id: newId,
      UnitPrice: pb.UnitPrice,
      IsActive: true,
    });
  }

  const children = await query(
    `SELECT vlocity_cmt__ChildProductId__c FROM vlocity_cmt__ProductChildItem__c
     WHERE vlocity_cmt__ParentProductId__c = '${source.Id}' AND vlocity_cmt__ChildProductId__c != null`
  );
  let lineNo = 1;
  for (const c of children.records) {
    await tryCreate(trace, 'composant', 'vlocity_cmt__ProductChildItem__c', {
      vlocity_cmt__ParentProductId__c: newId,
      vlocity_cmt__ChildProductId__c: c.vlocity_cmt__ChildProductId__c,
      vlocity_cmt__ChildLineNumber__c: String(lineNo++),
    });
  }

  // Relecture : un retour d'appel n'est pas une conclusion (convention EDF).
  const [verifyProduct, verifyAttrs, verifyCat, verifyPriceVloc, verifyPb, verifyChildren] = await Promise.all([
    query(`SELECT Id, Name, ProductCode, IsActive, Family FROM Product2 WHERE Id = '${newId}'`),
    query(`SELECT Id FROM vlocity_cmt__AttributeAssignment__c WHERE vlocity_cmt__ObjectId__c = '${newId}'`),
    query(`SELECT Id FROM vlocity_cmt__CatalogProductRelationship__c WHERE vlocity_cmt__Product2Id__c = '${newId}'`),
    query(`SELECT Id FROM vlocity_cmt__PriceListEntry__c WHERE vlocity_cmt__ProductId__c = '${newId}'`),
    query(`SELECT Id FROM PricebookEntry WHERE Product2Id = '${newId}'`),
    query(`SELECT Id FROM vlocity_cmt__ProductChildItem__c WHERE vlocity_cmt__ParentProductId__c = '${newId}'`),
  ]);

  return {
    sourceId: source.Id,
    sourceName: source.Name,
    newProductId: newId,
    newProductName: `${source.Name}${suffix}`,
    trace,
    verified: {
      produit: verifyProduct.records[0] || null,
      attributs: verifyAttrs.totalSize,
      categories: verifyCat.totalSize,
      tarificationVlocityCmt: verifyPriceVloc.totalSize,
      tarificationStandard: verifyPb.totalSize,
      composants: verifyChildren.totalSize,
    },
  };
}

module.exports = { createApiVariant };
