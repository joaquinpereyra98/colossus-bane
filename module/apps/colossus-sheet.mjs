import * as CONSTANTS from "../constants.mjs";
import { validUuid } from "../utils.mjs";

/**
 *
 * @returns {foundry.applications.sheets.ActorSheetV2}
 */
export default function createColossusSheet() {
  /**@type {foundry.applications.sheets.ActorSheetV2} */
  const AdversarySheetCls =
    game.system.api.applications.sheets.actors.Adversary;

  class ColossusSheet extends AdversarySheetCls {
    /** @type {Partial<foundry.applications.types.ApplicationConfiguration>} */
    static DEFAULT_OPTIONS = {
      classes: [CONSTANTS.MODULE_ID],
      actions: {
        deleteSegment: ColossusSheet.#onDeleteSegment,
        addSegmentByUuid: ColossusSheet.#onAddSegmentByUuid,
        placeTokens: ColossusSheet.#onPlaceTokens,
      },
    };

    /**@type {Record<string, import("@client/applications/api/handlebars-application.mjs").HandlebarsTemplatePart>} */
    static PARTS = {
      ...super.PARTS,
      segments: {
        template: `${CONSTANTS.TEMPLATE_PATH}/colossus-sheet/segments.hbs`,
        scrollable: [".segments-section"],
      },
    };

    /** @override */
    static TABS = {
      primary: {
        tabs: [
          { id: "features" },
          { id: "segments", label: "Segments" },
          { id: "effects" },
          { id: "notes" },
        ],
        initial: "features",
        labelPrefix: "DAGGERHEART.GENERAL.Tabs",
      },
    };

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /**@type {foundry.documents.Actor[]} */
    #segments;

    get segments() {
      return this.#segments;
    }

    /** @inheritDoc */
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.segments = this.#segments = await this.actor.system.getSegments();

      return context;
    }

    /* -------------------------------------------- */

    /**@type {foundry.applications.ux.DragDrop}*/
    #segmentsDragDrop;

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _onRender(context, options) {
      await super._onRender(context, options);

      for (const segmentActor of this.segments) {
        segmentActor.apps[this.id] = this;
      }

      if (options.parts.includes("segments")) {
        const DragDrop = foundry.applications.ux.DragDrop.implementation;
        this.#segmentsDragDrop = new DragDrop({
          dropSelector: `.segments-section`,
          callbacks: {
            drop: this.#onDrop.bind(this),
          },
        });

        this.#segmentsDragDrop.bind(this.element);
      }
    }

    /** @inheritDoc */
    _onClose(options) {
      super._onClose(options);
      for (const segmentActor of this.segments) {
        delete segmentActor.apps[this.id];
      }
    }

    /**
     * Handle a drop event.
     * @param {DragEvent} event
     */
    async #onDrop(event) {
      const data =
        foundry.applications.ux.TextEditor.implementation.getDragEventData(
          event
        );
      const actor = this.actor;

      const allowed = Hooks.call("dropActorSheetData", actor, this, data);
      if (allowed === false) return;

      const documentClass = foundry.utils.getDocumentClass(data.type);
      if (!documentClass) return;

      /**@type {foundry.abstract.Document} */
      const document = await documentClass.fromDropData(data);
      if (document?.documentName !== "Actor" || !document?.type === "adversary")
        return;

      const segments = [...actor._source.system.segments, document.uuid];
      
      await actor.update({
        "system.segments": segments,
      });
    }

    /* -------------------------------------------- */
    /*  Event Handlers                              */
    /* -------------------------------------------- */

    /**
     * @this {ColossusSheet}
     * @type {import("@client/applications/_types.mjs").ApplicationClickAction}
     */
    static async #onDeleteSegment(event, target) {
      const el = target.closest("[data-item-uuid]");
      const uuid = el?.dataset.itemUuid ?? null;

      if (!uuid) return;

      const segments = this.actor._source.system.segments;
      const update = segments.filter((segmentUUID) => segmentUUID !== uuid);

      if (update === segments) return;

      const segmentUuid = fromUuidSync(uuid);

      if (!event.shiftKey) {
        const confirmed = await foundry.applications.api.Dialog.confirm({
          content: `Are you sure you want to delete ${segmentUuid.name} from the segments of ${this.actor.name}?`,
        });

        if (!confirmed) return;
      }

      ui.notifications.info(
        `The actor ${segmentUuid.name} has been removed from the segments.`
      );

      await this.actor.update({ "system.segments": update });
    }

    /**
     * Adds a new actor UUID to the Colossus's list of segments.
     * @this {ColossusSheet}
     * @type {import("@client/applications/_types.mjs").ApplicationClickAction}
     */
    static #onAddSegmentByUuid(_event, target) {
      const input = target
        .closest(".uuid-input-group")
        ?.querySelector("input.uuid-input-button");
      const newUuid = input?.value?.trim();

      if (!newUuid || !validUuid(newUuid, { type: "Actor" }))
        return ui.notifications.error("Must be a valid uuid");

      const segments = this.actor.toObject().system.segments;
      if (segments.includes(newUuid)) return;
      segments.push(newUuid);
      return this.actor.update({ "system.segments": segments });
    }

    /**
     * 
     * @this {ColossusSheet}
     * @type {import("@client/applications/_types.mjs").ApplicationClickAction}
     */
    static #onPlaceTokens(_event) {
      this.actor.system.performTokenPlacement({ minimizeSheet: true });
    }
  }

  return ColossusSheet;
}
