/**
 * A line-based connection between two Tokens on the canvas.
 * @typedef {Object} Connection
 * @property {foundry.canvas.placeables.Token} from - The starting token.
 * @property {foundry.canvas.placeables.Token} to - The ending token.
 * @property {PIXI.Graphics} line - The rendered line object.
 */

/**
 * Manages visual line connections between Tokens.
 */
export default class TokenConnections {

  /** @type {Connection[]} */
  connections = [];

  /** PIXI container holding all connection lines */
  get connectionContainer() {
    if (!this.#connectionContainer) {
      this.#connectionContainer = new PIXI.Container();
      this.parent.addChildAt(this.#connectionContainer, 0);
    }

    return this.#connectionContainer;
  }

/**
 * @return {foundry.utils.Collection<string, foundry.canvas.placeables.Token>}
 */
  get colossusTokens() {
    const entries = canvas.tokens.placeables
    .filter((t) => t.actor.type === DOCUMENT_TYPES.Actor.Colossus)
    .map((t) => [t.actor.id, t.actor]);

    return new foundry.utils.Collection(entries)
  }

  /** PIXI container holding all connection lines */
  #connectionContainer;

  /** The TokenLayer this instance is attached to */
  get parent() {
    return canvas.tokens;
  }

  /**
   * Add (or replace) a connection between two tokens.
   * Accepts Token objects or TokenDocuments.
   *
   * @param {foundry.canvas.placeables.Token|foundry.documents.TokenDocument} from
   * @param {foundry.canvas.placeables.Token|foundry.documents.TokenDocument} to
   * @returns {Connection}
   */
  addConnection(from, to) {
    from = this._asToken(from);
    to = this._asToken(to);

    // Remove any previous connection between the same tokens
    this.removeConnection(from, to);

    const line = new PIXI.Graphics();
    this.connectionContainer.addChild(line);

    const connection = { from, to, line };
    this.connections.push(connection);

    this._drawConnection(connection);
    return connection;
  }

  /** Redraw all connections. */
  updateAllConnections() {
    for (const c of this.connections) this._drawConnection(c);
  }

  /**
   * Remove an existing connection between two tokens.
   *
   * @param {foundry.canvas.placeables.Token} from
   * @param {foundry.canvas.placeables.Token} to
   */
  removeConnection(from, to) {
    from = this._asToken(from);
    to = this._asToken(to);

    const index = this.connections.findIndex(
      (c) => c.from === from && c.to === to
    );
    if (index === -1) return;

    this.connections[index].line.destroy(true);
    this.connections.splice(index, 1);
  }

  /**
   * Draw a single connection line.
   * @param {Connection} connection
   * @private
   */
  _drawConnection({ from, to, line }) {
    const A = from.center;
    const B = to.center;

    line.clear();
    line.lineStyle(3, 0x00bbff, 1);
    line.moveTo(A.x, A.y);
    line.lineTo(B.x, B.y);
  }

  /**
   * Normalize TokenDocument → Token object.
   * @param {foundry.canvas.placeables.Token|foundry.documents.TokenDocument} t
   * @returns {foundry.canvas.placeables.Token}
   * @private
   */
  _asToken(t) {
    return t instanceof foundry.documents.TokenDocument ? t.object : t;
  }
}
