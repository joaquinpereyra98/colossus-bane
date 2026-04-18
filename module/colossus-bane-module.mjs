import data from "./data/_module.mjs";
import apps from "./apps/_module.mjs";
import canvas from "./canvas/token-placement.mjs";
import * as CONSTANTS from "./constants.mjs";

/**
 * Core module class for Colossus Bane functionality and data model management.
 */
export default class ColossusBaneModule {
  /** @returns {Object} Default API structure with data classes. */
  static get DEFAULT_API() {
    return {
      data: { ...data.classes },
      canvas,
    };
  }

  /** Initializes the module and its data models. */
  static init() {
    this.initDataModels();
    this.initApplications();
  }

  /**
   * @returns {foundry.packages.Module} The Foundry module instance
   */
  static get module() {
    return game.modules.get(CONSTANTS.MODULE_ID);
  }

  /** @returns {Object} The module API, initializing if necessary. */
  static get api() {
    return (this.module.api ??= this.DEFAULT_API);
  }

  /** Initializes all data models */
  static initDataModels() {
    const api = this.api;
    for (const [docType, fn] of Object.entries(data.functions)) {
      const cls = fn();
      api.data[docType] = cls;
      CONFIG.Actor.dataModels[docType] = cls;
    }

    console.log(`${CONSTANTS.MODULE_ID} | DataModels initialized`);
  }
  /** Initializes all applications */

  static initApplications() {
    const { DocumentSheetConfig } = foundry.applications.apps;
    for (const [documentName, sheets] of Object.entries(
      apps.functions.sheets
    )) {
      const cls = foundry.utils.getDocumentClass(documentName);
      for (const [type, fn] of Object.entries(sheets)) {
        const sheetCls = fn();
        DocumentSheetConfig.registerSheet(cls, CONSTANTS.MODULE_ID, sheetCls, {
          makeDefault: true,
          types: [type],
        });
      }
    }

    console.log(`${CONSTANTS.MODULE_ID} | Applications initialized`);
  }
}
