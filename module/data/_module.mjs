import * as CONSTANTS from "../constants.mjs";
import createColossusDataModel from "./colossus.mjs";

const config = {
  functions: {
    [CONSTANTS.DOCUMENT_TYPES.Actor.Colossus]: createColossusDataModel,
  },
  classes: {},
};

export default config;
