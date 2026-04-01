import { parseNoteRoute } from '../utils/note-route.js';

export default class SyncNoteRouteCommand {
  async execute({ payload = {}, stores }) {
    const locationLike = payload.locationLike || (typeof window !== 'undefined' ? window.location : {});
    const route = parseNoteRoute(locationLike);
    stores.app.route = route;
    stores.note.route = route;
    return route;
  }
}
