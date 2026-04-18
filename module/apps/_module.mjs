import createColossusSheet from "./colossus-sheet.mjs";
import * as CONSTANTS from "../constants.mjs";

const config = {
  functions: {
    sheets: {
      Actor: {
        [CONSTANTS.DOCUMENT_TYPES.Actor.Colossus]: createColossusSheet,
      }
    }
  },
  classes: {},
};

export default config;