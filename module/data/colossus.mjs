import * as CONSTANTS from "../constants.mjs";
import { validUuid } from "../utils.mjs";
import TokenPlacement from "../canvas/token-placement.mjs";
/**
 *
 * @returns {foundry.abstract.TypeDataModel}
 */
export default function createColossusDataModel() {
  /**@type {typeof foundry.abstract.TypeDataModel} */
  const AdversaryCls = game.system.api.models.actors.DhAdversary;

  class ColossusDataModel extends AdversaryCls {
    /**@inheritdoc */
    static DEFAULT_ICON = `${CONSTANTS.ASSETS_PATH}/documents/battle-mech.svg`;

    /** @inheritdoc */
    static defineSchema() {
      const { SetField, DocumentUUIDField } = foundry.data.fields;
      const schema = super.defineSchema();
      return {
        ...schema,
        segments: new SetField(new DocumentUUIDField({ type: "Actor" })),
      };
    }

    /**
     * Called by ClientDocumentMixin#_preUpdate.
     * @param {object} changes            The candidate changes to the Document
     * @param {object} options            Additional options which modify the update request
     * @param {foundry.documents.BaseUser} user   The User requesting the document update
     * @returns {Promise<boolean|void>}   A return value of false indicates the update operation should be cancelled.
     */
    async _preUpdate(changes, options, user) {
      const superResult = await super._preUpdate(changes, options, user);
      if (superResult === false) return false;

      const hasSegments = foundry.utils.hasProperty(changes, "system.segments");
      if (!hasSegments) return;

      const isValidSegment = this._validateSegments(changes.system, {});
      if (isValidSegment === false) return false;

      const allowed = await super._preUpdate(changes, options, user);
      if (allowed === false) return false;

      const segments = await Promise.all(
        changes.system.segments.map(async (uuid) => {
          const doc = await foundry.utils.fromUuid(uuid);
          if (doc) return doc.uuid;
          console.warn(
            `${CONSTANTS.MODULE_ID} | ${this.parent.name} Actor _preUpdate | Segment Actor not found and will be removed:`,
            uuid
          );
          return;
        })
      );

      changes.system.segments = segments.filter(Boolean);
    }

    /* -------------------------------------------- */
    /*  Validation                                  */
    /* -------------------------------------------- */

    /**@inheritdoc */
    validate(options = {}) {
      const source = options.changes ?? this._source;
      if ("segments" in source) return this._validateSegments(source, options);
      return super.validate(options);
    }

    /**
     * Validates segments and handles errors
     * @param {object} data - The data containing segments to validate
     * @returns {boolean} - True if validation passes, false if it fails
     */
    _validateSegments(data, { strict } = {}) {
      const failure = this._validateSegmentsElements(data.segments, {});
      if (!failure) return true;
      const id = this._source._id ? `[${this._source._id}] ` : "";
      failure.message = `${this.constructor.name} ${id}validation errors:`;

      if (strict && failure.unresolved) throw failure.asError();
      else logger.warn(failure.asError());
      return false;
    }

    /**
     * Validate every element of the Segments Field
     * @param {String[]} segments - The array to validate
     * @param {foundry.data.types.DataFieldValidationOptions} options - Validation options
     * @returns {foundry.data.validation.DataModelValidationFailure|void} A validation failure if any of the elements failed validation, otherwise void.
     */
    _validateSegmentsElements(segments, _options) {
      const { DataModelValidationFailure } = foundry.data.validation;
      const arrayFailure = new DataModelValidationFailure();

      for (let i = 0; i < segments.length; i++) {
        const failure = this._validateElementCollection(segments[i]);
        if (failure) {
          arrayFailure.elements.push({ id: i, failure });
          arrayFailure.unresolved ||= failure.unresolved;
        }
        if (arrayFailure.elements.length) return arrayFailure;
      }
    }

    /**
     * Validate a single element of the Segments Field.
     * @param {String} uuid - The value of the array element
     * @returns {foundry.data.validation.DataModelValidationFailure} A validation failure if the element failed validation
     */
    _validateElementCollection(uuid) {
      const { DataModelValidationFailure } = foundry.data.validation;

      const fail = (message) =>
        new DataModelValidationFailure({
          invalidValue: uuid,
          message,
          unresolved: true,
        });

      try {
        if (!validUuid(uuid, { type: "Actor" })) {
          return fail(`${uuid} must be a valid UUID`);
        }

        const parentPack = this.parent.pack;
        const [primaryType, scope, packName] = uuid.split(".");
        const inCompenidum = primaryType === "Compenidum";

        if (inCompenidum !== Boolean(parentPack)) {
          return fail(`${uuid} must be a valid UUID`);
        } else if (inCompenidum && `${scope}.${packName}` !== parentPack) {
          return fail(
            `${uuid} must belong to the same Compendium as ${this.parent.uuid}`
          );
        }

        return undefined; // Validation passed
      } catch (err) {
        return fail(err.message);
      }
    }

    /* -------------------------------------------- */
    /*  Public API                                  */
    /* -------------------------------------------- */

    /**
     *
     * @returns {Promise<foundry.documents.Actor[]>}
     */
    async getSegments() {
      return new Set(
        await Promise.all([...this.segments].map((uuid) => fromUuid(uuid)))
      ).filter((a) => a);
    }

    /**
     * A helper for positioning segment tokens
     * @param {object} options
     * @param {boolean} options.minimizeSheet - Minimize the actor's sheet?
     */
    async performTokenPlacement({ minimizeSheet = false } = {}) {
      if (!game.user.can("TOKEN_CREATE")) {
        return ui.notifications.warn(
          "You do not have permission to create new Tokens!"
        );
      }
      if (!this.parent.canUserModify(game.user, "update")) {
        return ui.notifications.warn(
          "You do not have permission to update the Colossus Actor!"
        );
      }

      /* -----------------------------------------------------------
       * Prepare Tokens
       * ---------------------------------------------------------*/
      const baseActor = this.parent;
      const segmentActors = await this.getSegments();
      const tokens = [baseActor, ...segmentActors].map((a) => a.prototypeToken);

      /* -----------------------------------------------------------
       * Optionally Minimize Sheet
       * ---------------------------------------------------------*/
      let minimized = false;
      if (minimizeSheet && this.parent?.sheet) {
        minimized = !this.parent.sheet.minimized;
        await this.parent.sheet.minimize();
      }

      /* -----------------------------------------------------------
       *Ask the placement helper for where tokens should go
       * ---------------------------------------------------------*/
      const placements = await TokenPlacement.place({ tokens });
      const createData = [];

      /* -----------------------------------------------------------
       * Build creation data for each placed token
       * ---------------------------------------------------------*/
      for (let i = 0; i < placements.length; i++) {
        const placement = placements[i];
        const { actor, actorLink, appendNumber } = placement.prototypeToken;

        delete placement.prototypeToken;

        /** @type {foundry.documents.TokenDocument} */
        const tokenDocument = await actor.getTokenDocument(placement);

        tokenDocument.updateSource({ _id: foundry.utils.randomID() });

        if (!actorLink && appendNumber) {
          TokenPlacement.adjustAppendedNumber(tokenDocument, placement);
        }

        const data = tokenDocument.toObject();
        data.actorUuid = actorLink
          ? actor.uuid
          : `${canvas.scene.uuid}.Token.${data._id}.${actor.uuid}`;
        createData.push(data);
      }

      if (!createData.length) return;

      const parentData = createData[0];

      // Get UUIDs of all children (index 1 and above)
      const childUuids = createData.slice(1).map((d) => d.actorUuid);

      if (!parentData.actorLink) {
        // Add all children to the Delta (Synthetic storage)
        foundry.utils.setProperty(
          parentData,
          "delta.system.segments",
          childUuids
        );
      } else {
        const hasUnlinkedChildren = createData
          .slice(1)
          .some((p) => !p.actorLink);
        if (hasUnlinkedChildren) {
          const objectData = baseActor.toObject();
          const set = new Set(objectData.system.segments);
          childUuids.forEach((u) => set.add(u));
          var sidebarUpdateList = Array.from(set);
        }
      }

      const documents = await canvas.scene.createEmbeddedDocuments(
        "Token",
        createData,
        {
          keepId: true,
        }
      );

      for (const segmentActorToken of documents.slice(1)) {
        canvas.tokens[CONSTANTS.MODULE_KEY].addConnection(
          documents[0],
          segmentActorToken
        );
      }

      if (sidebarUpdateList) {
        await baseActor.update({ "system.segments": sidebarUpdateList });
      }

      if (minimized) {
        await this.parent.sheet.maximize();
      }
    }
  }

  return ColossusDataModel;
}
