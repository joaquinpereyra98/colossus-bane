import * as CONSTANTS from "../constants.mjs";

/**
 *
 * @param {foundry.canvas.layers.TokenLayer} tokenLayer
 */
export default function onDrawTokenLayer(tokenLayer) {
  const COLOSSUS_TYPE = CONSTANTS.DOCUMENT_TYPES.Actor.Colossus;
  const colossusTokens = new Map();
  const notColossusTokens = new Map();

  tokenLayer.placeables.forEach((t) => {
    if (!t?.actor) return;

    const isColossus = t.actor.type === COLOSSUS_TYPE;
    const map = isColossus ? colossusTokens : notColossusTokens;
    
    map.set(t.actor.uuid, t.document);
  });

  for (const colossusToken of colossusTokens.values()) {
    const segments = colossusToken.actor.system.segments;

    if (!segments) continue;

    for (const segmentUuid of segments) {
      const segmentActor = notColossusTokens.get(segmentUuid);
      if (segmentActor) {
        tokenLayer[CONSTANTS.MODULE_KEY].addConnection(
          colossusToken,
          segmentActor
        );
      }
    }
  }
}
