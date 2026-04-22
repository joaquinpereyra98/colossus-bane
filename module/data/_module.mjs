import * as CONSTANTS from "../constants.mjs";
import ColossusDataModel from "./colossus.mjs";

const { Colossus } = CONSTANTS.DOCUMENT_TYPES.Actor;

export default {
  Actor: {
    [Colossus]: ColossusDataModel,
  },
};
