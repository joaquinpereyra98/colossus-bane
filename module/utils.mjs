/**
 * Validate whether a UUID string is structurally valid and meets provided constraints.
 * @param {string} uuid - The UUID string to validate
 * @param {Object} options - Optional validation rules
 * @param {string} [options.type] - A specific document type in {@link CONST.ALL_DOCUMENT_TYPES} required by this field
 * @param {boolean} [options.embedded] - Does this field require (or prohibit) embedded documents?
 * @returns {boolean}
 * @returns
 */
export function validUuid(uuid, options = {}) {
  const p = foundry.utils.parseUuid(uuid);

  if (p.type && !CONST.ALL_DOCUMENT_TYPES.includes(p.type)) return false;
  if (options.type && p.type !== options.type) return false;
  if (options.embedded === true && !p.embedded.length) return false;
  if (options.embedded === false && p.embedded.length) return false;
  if (!foundry.data.validators.isValidId(p.documentId)) return false;

  return true;
}
