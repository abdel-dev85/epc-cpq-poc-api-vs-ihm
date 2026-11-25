'use strict';

/**
 * Assemblage d'un blueprint de produit par sondage defensif de deux object
 * models possibles :
 *   - l'objet model "Industries CPQ / Product Catalog Management" standard
 *     (ProductCategoryProduct, ProductAttributeDefinition, PricebookEntry,
 *     ProductRelatedComponent) ;
 *   - l'objet model **Vlocity CMT** (`vlocity_cmt__*`), constate en pratique
 *     sur ce trial : les objets standard existent mais sont vides pour tous
 *     les produits (sonde), alors que `vlocity_cmt__AttributeAssignment__c`,
 *     `vlocity_cmt__PriceListEntry__c`, `vlocity_cmt__CatalogProductRelationship__c`
 *     et `vlocity_cmt__ProductChildItem__c` portent les donnees reelles.
 * La variante installee sur un org donne n'est pas connue a l'avance : chaque
 * objet candidat est d'abord decrit, et ignore proprement s'il n'existe pas,
 * plutot que de faire echouer tout l'outil.
 */

const { describeSObject, query } = require('./sf-rest-client');

const ID_PATTERN = /^[a-zA-Z0-9]{15,18}$/;

function escapeSoql(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Sondes de sections liees au produit : chacune se desactive si l'objet ou le
 * champ de jointure (`whereField`) n'existe pas. Les autres champs
 * (`fields`) sont de simples candidats — un champ absent sur cet org/edition
 * (ex. multi-devise non active) est retire et la requete retentee plutot que
 * d'abandonner toute la section : voir `queryWithFieldFallback`.
 */
const RELATED_PROBES = [
  {
    section: 'categories',
    object: 'ProductCategoryProduct',
    whereField: 'ProductId',
    fields: ['ProductCategoryId', 'ProductCategory.Name', 'IsPrimaryCategory'],
  },
  {
    section: 'attributs',
    object: 'ProductAttributeDefinition',
    whereField: 'Product2Id',
    fields: ['Id', 'AttributeDefinition.Name', 'AttributeDefinition.DataType', 'Sequence', 'IsRequired', 'IsReadOnly', 'IsHidden'],
    orderBy: 'Sequence',
  },
  {
    section: 'modelesDeVente',
    object: 'ProductSellingModelOption',
    whereField: 'Product2Id',
    fields: ['ProductSellingModelId', 'ProductSellingModel.Name', 'ProductSellingModel.SellingModelType'],
  },
  {
    section: 'tarification',
    object: 'PricebookEntry',
    whereField: 'Product2Id',
    fields: ['Pricebook2.Name', 'UnitPrice', 'IsActive', 'CurrencyIsoCode'],
  },
  {
    section: 'composants',
    object: 'ProductRelatedComponent',
    whereField: 'ParentProductId',
    fields: ['ChildProductId', 'ChildProduct.Name', 'ProductComponentGroupId', 'MinQuantity', 'MaxQuantity'],
  },

  // --- Vlocity CMT (vlocity_cmt__*) - constate sur ce trial, voir l'en-tete. ---
  {
    section: 'categoriesVlocityCmt',
    object: 'vlocity_cmt__CatalogProductRelationship__c',
    whereField: 'vlocity_cmt__Product2Id__c',
    fields: ['vlocity_cmt__CatalogId__c', 'vlocity_cmt__CatalogId__r.Name'],
  },
  {
    section: 'attributsVlocityCmt',
    object: 'vlocity_cmt__AttributeAssignment__c',
    whereField: 'vlocity_cmt__ObjectId__c',
    fields: [
      'Id', 'Name',
      'vlocity_cmt__AttributeId__r.Name', 'vlocity_cmt__AttributeId__r.vlocity_cmt__Code__c',
      'vlocity_cmt__AttributeId__r.vlocity_cmt__ValueType__c', 'vlocity_cmt__AttributeId__r.vlocity_cmt__Value__c',
      'vlocity_cmt__AttributeCategoryId__r.Name',
    ],
  },
  {
    section: 'tarificationVlocityCmt',
    object: 'vlocity_cmt__PriceListEntry__c',
    whereField: 'vlocity_cmt__ProductId__c',
    fields: ['Name', 'vlocity_cmt__PriceListId__r.Name', 'vlocity_cmt__IsBasePrice__c'],
  },
  {
    section: 'composantsVlocityCmt',
    object: 'vlocity_cmt__ProductChildItem__c',
    whereField: 'vlocity_cmt__ParentProductId__c',
    fields: ['vlocity_cmt__ChildProductId__c', 'vlocity_cmt__ChildProductId__r.Name'],
  },
];

/** Nom de champ invalide, tel que Salesforce le nomme dans son message d'erreur SOQL. */
function invalidFieldFrom(message) {
  const match = /No such column '([^']+)' on entity/.exec(message);
  return match ? match[1] : null;
}

/**
 * Execute une requete en retirant, un a la fois, les champs que l'org rend
 * invalides (INVALID_FIELD), jusqu'a ce qu'elle passe ou qu'il n'en reste
 * plus. Rend aussi la liste des champs abandonnes, pour que l'appelant le
 * documente plutot que de le taire.
 */
async function queryWithFieldFallback(object, fields, whereClause, orderBy) {
  let remaining = [...fields];
  const dropped = [];

  while (remaining.length) {
    const select = `SELECT ${remaining.join(', ')} FROM ${object} WHERE ${whereClause}`
      + (orderBy ? ` ORDER BY ${orderBy}` : '');
    try {
      const result = await query(select);
      return { records: result.records, dropped };
    } catch (err) {
      const bad = invalidFieldFrom(err.message);
      // Le champ fautif peut porter un prefixe de relation (Pricebook2.Name) :
      // on le compare a la fois tel quel et sur son dernier segment.
      const index = bad && remaining.findIndex(f => f === bad || f.endsWith(`.${bad}`));
      if (bad && index !== undefined && index >= 0) {
        dropped.push(remaining[index]);
        remaining.splice(index, 1);
        continue;
      }
      throw err;
    }
  }

  throw new Error(`Tous les champs candidats de ${object} sont invalides sur cet org.`);
}

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
    const hasField = describe.fields.some(f => f.name.toLowerCase() === probe.whereField.toLowerCase());
    if (!hasField) {
      blueprint.omis.push({
        section: probe.section, objet: probe.object,
        raison: `champ ${probe.whereField} absent de ${probe.object} sur cet org`,
      });
      continue;
    }

    try {
      const { records, dropped } = await queryWithFieldFallback(
        probe.object, probe.fields, `${probe.whereField} = '${product.Id}'`, probe.orderBy
      );
      blueprint.sections[probe.section] = { objet: probe.object, enregistrements: records };
      if (dropped.length) {
        blueprint.omis.push({
          section: probe.section, objet: probe.object,
          raison: `champ(s) ignore(s), absents de cet org/edition : ${dropped.join(', ')}`,
        });
      }
    } catch (err) {
      blueprint.omis.push({ section: probe.section, objet: probe.object, raison: err.message });
    }
  }

  return blueprint;
}

module.exports = { buildProductBlueprint, resolveProduct, escapeSoql, ID_PATTERN };
