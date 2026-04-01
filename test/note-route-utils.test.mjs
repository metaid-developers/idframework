import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNoteRoutePath,
  parseNoteRoute,
  buildNoteRouteUrl,
  getCurrentNoteRouteUrl,
  resolveNoteRouteMode,
} from '../idframework/utils/note-route.js';

test('parseNoteRoute maps /note/:id/edit and query string correctly', () => {
  const route = parseNoteRoute({ hash: '#/note/abc/edit?draftId=3' });
  assert.equal(route.view, 'editor');
  assert.equal(route.params.id, 'abc');
  assert.equal(route.query.draftId, '3');
});

test('note route helpers provide the full required contract', () => {
  assert.equal(normalizeNoteRoutePath('note/abc'), '/note/abc');
  assert.equal(
    resolveNoteRouteMode(
      { pathname: '/demo-note/index.html' },
      { IDFrameworkConfig: { noteRouteMode: 'hash' } },
    ),
    'hash',
  );
  assert.match(
    buildNoteRouteUrl(
      { pathname: '/demo-note/index.html', search: '' },
      '/draft',
      { IDFrameworkConfig: { noteRouteMode: 'hash' } },
    ),
    /#\/draft$/,
  );
  assert.equal(
    getCurrentNoteRouteUrl(
      { pathname: '/demo-note/index.html', search: '', hash: '#/mynote' },
      { IDFrameworkConfig: { noteRouteMode: 'hash' } },
    ),
    '/demo-note/index.html#/mynote',
  );
});
