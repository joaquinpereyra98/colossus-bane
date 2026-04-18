import TokenConnections from "../canvas/token-connections.mjs";
import * as CONSTANTS from "../constants.mjs";

/**
 * A hook event that fires when a Token is destroyed.
 * @param {foundry.canvas.placeables.Token} token
 * @returns
 */
export default function onDestroyToken(token) {
  /**@type {TokenConnections} */
  const tokenConnections = canvas.tokens[CONSTANTS.MODULE_KEY];
  const connections = tokenConnections.connections.filter(({ from, to }) =>
    [from, to].includes(token)
  );

  if (connections.length)
    return connections.map((c) =>
      tokenConnections.removeConnection(c.from, c.to)
    );
}
