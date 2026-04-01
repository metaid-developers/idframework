import { adaptNoteSummary } from '../utils/note-adapter.js';

const NOTE_PROTOCOL = '/protocols/simplenote';

function shouldAppendPage(cursor) {
  if (cursor === undefined || cursor === null) return false;
  var text = String(cursor).trim();
  return text !== '' && text !== '0';
}

function normalizePinListResponse(response) {
  const payload = response && typeof response === 'object' && response.data && typeof response.data === 'object'
    ? response.data
    : (response && typeof response === 'object' ? response : {});
  const list = Array.isArray(payload.list) ? payload.list : [];
  const total = Number(payload.total);
  const nextCursor = payload.nextCursor !== undefined && payload.nextCursor !== null ? payload.nextCursor : '';

  return {
    list,
    total: Number.isFinite(total) ? total : list.length,
    nextCursor,
  };
}

export default class FetchNoteListCommand {
  async execute({ payload = {}, stores = {}, delegate }) {
    if (typeof delegate !== 'function') {
      throw new Error('FetchNoteListCommand: delegate is required');
    }

    const listStore = stores.note && stores.note.publicList ? stores.note.publicList : null;
    const cursor = payload.cursor ?? 0;
    const size = Number(payload.size ?? 20);
    const query = new URLSearchParams({
      path: NOTE_PROTOCOL,
      cursor: String(cursor),
      size: String(Number.isFinite(size) && size > 0 ? size : 20),
    });

    if (listStore) {
      listStore.isLoading = true;
      listStore.error = '';
    }

    try {
      const response = await delegate('metaid_man', `/pin/path/list?${query.toString()}`, {
        method: 'GET',
      });
      const normalized = normalizePinListResponse(response);
      const pageItems = normalized.list.map((pin) => ({
        pin,
        noteData: adaptNoteSummary(pin).noteData,
      }));
      const existingItems = listStore && Array.isArray(listStore.items) ? listStore.items : [];
      const items = shouldAppendPage(payload.cursor) ? existingItems.concat(pageItems) : pageItems;
      const result = {
        items,
        total: normalized.total,
        cursor: normalized.nextCursor,
        hasMore: normalized.nextCursor !== '' && normalized.nextCursor !== null && normalized.nextCursor !== undefined,
      };

      if (listStore) {
        listStore.items = items;
        listStore.cursor = result.cursor;
        listStore.hasMore = result.hasMore;
      }

      return result;
    } catch (error) {
      if (listStore) listStore.error = error && error.message ? error.message : String(error);
      throw error;
    } finally {
      if (listStore) listStore.isLoading = false;
    }
  }
}
