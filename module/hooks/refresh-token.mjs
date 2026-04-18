import TokenConnections from "../canvas/token-connections.mjs";
import * as CONSTANTS from "../constants.mjs";


/**
 * A hook event that fires when a Token is incrementally refreshed.
 * @param {foundry.canvas.placeables.Token} token 
 * @param {Record<string, boolean>} flags 
 * @returns 
 */
export default function onRefreshToken(token, flags) {
  /**@type {foundry.canvas.layers.TokenLayer} */
  const layer = canvas.tokens;
  if (!layer || (!flags.refreshShape && !flags.refreshPosition)) return;

  /**@type {TokenConnections} */
  const tokenConnections = layer[CONSTANTS.MODULE_KEY];
  const inSomeConnection = tokenConnections.connections.some(({ from, to }) =>
    [from, to].includes(token)
  );

  if (inSomeConnection) return tokenConnections.updateAllConnections();
}
