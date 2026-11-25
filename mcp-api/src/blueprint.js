'use strict';

/**
 * Assemblage d'un blueprint de produit par sondage defensif de l'objet model
 * "Industries CPQ / Product Catalog Management" standard (Product2,
 * ProductCategory, AttributeDefinition, ProductSellingModel, PricebookEntry,
 * ProductRelatedComponent - voir docs/transposition-epc-cpq.md du depot
 * voisin). La variante installee sur le trial n'est pas connue a l'avance :
 * chaque objet candidat est d'abord decrit, et ignore proprement s'il
 * n'existe pas sur cet org, plutot que de faire echouer tout l'outil.
 */

const { describeSObject, query } = require('./sf-rest-client');

const ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;

function escapeSoql(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Sondes de sections liees au produit : chacune se desactive si l'objet ou le champ cle n'existe pas. */
const RELATED_PROBES = [
  {
    section: 'categories',
    object: 'ProductCategoryProduct',
    requiredField: 'ProductId',
    soql: (id) => `SELECT ProductCategoryId, ProductCategory.Name, IsPrimaryCategory
                    FROM ProductCategoryProduct WHERE ProductId = '${id}'`,
  },
  {
    section: 'attributs',
    object: 'ProductAttributeDefinition',
    requiredField: 'Product2Id',
    soql: (id) => `SELECT Id, AttributeDefinition.Name, AttributeDefinition.DataType,
                           Sequence, IsRequired, IsReadOnly, IsHidden
                    FROM ProductAttributeDefinition WHERE Product2Id = '${id}' ORDER BY Sequence`,
  },
  {
    section: 'modelesDeVente',
    object: 'ProductSellingModelOption',
    requiredField: 'Product2Id',
    soql: (id) => `SELECT ProductSellingModelId, ProductSellingModel.Name, ProductSellingModel.SellingModelType
                    FROM ProductSellingModelOption WHERE Product2Id = '${id}'`,
  },
  {
    section: 'tarification',
    object: 'PricebookEntry',
    requiredField: 'Product2Id',
    soql: (id) => `SELECT Pricebook2.Name, UnitPrice, IsActive, CurrencyIsoCode
                    FROM PricebookEntry WHERE Product2Id = '${id}'`,
  },
  {
    section: 'composants',
    object: 'ProductRelatedComponent',
    requiredField: 'ParentProductId',
    soql: (id) => `SELECT ChildProductId, ChildProduct.Name, ProductComponentGroupId, MinQuantity, MaxQuantity
                    FROM ProductRelatedComponent WHERE ParentProductId = '${id}'`,
  },
];

async function resolveProduct(productIdOrName) {
  if (ID_PATTERN.test(productIdOrName)) {
    const result = await query(
      `SELECT Id, Name, ProductCode, Description, IsActive, Family
       FROM Product2 WHERE Id = '${productIdOrName}'`
    );
    if (!result.records.length) {
      throw new Error(`Aucun Product2 avec l'Id "${productIdOrName}" sur cet org.`);
    }
    return result.records[0];
  }

  const term = escapeSoql(productIdOrName);
  const result = await query(
    `SELECT Id, Name, ProductCode, Description, IsActive, Family
     FROM Product2 WHERE Name LIKE '%${term}%' ORDER BY Name LIMIT 5`
  );

  if (!result.records.length) {
    throw new Error(`Aucun Product2 ne correspond a "${productIdOrName}". Essayez epc_api_search_product.`);
  }
  if (result.records.length > 1) {
    const choices = result.records.map(r => `${r.Name} (${r.Id})`).join(', ');
    throw new Error(`Plusieurs produits correspondent a "${productIdOrName}" : ${choices}. Preciser l'Id.`);
  }
  return result.records[0];
}

async function buildProductBlueprint(productIdOrName) {
  const product = await resolveProduct(productIdOrName);
  const blueprint = {
    source: {
      Id: product.Id,
      Name: product.Name,
      ProductCode: product.ProductCode,
      Description: product.Description,
      IsActive: product.IsActive,
      Family: product.Family,
    },
    sections: {},
    omis: [],
  };

  for (const probe of RELATED_PROBES) {
    const describe = await describeSObject(probe.object);
    if (!describe) {
      blueprint.omis.push({ section: probe.section, objet: probe.object, raison: 'objet absent de cet org' });
      continue;
    }
    const hasField = describe.fields.some(f => f.name.toLowerCase() === probe.requiredField.toLowerCase());
    if (!hasField) {
      blueprint.omis.push({
        section: probe.section, objet: probe.object,
        raison: `champ ${probe.requiredField} absent de ${probe.object} sur cet org`,
      });
      continue;
    }

    try {
      const result = await query(probe.soql(product.Id));
      blueprint.sections[probe.section] = { objet: probe.object, enregistrements: result.records };
    } catch (err) {
      blueprint.omis.push({ section: probe.section, objet: probe.object, raison: err.message });
    }
  }

  return blueprint;
}

module.exports = { buildProductBlueprint, resolveProduct, escapeSoql, ID_PATTERN };
