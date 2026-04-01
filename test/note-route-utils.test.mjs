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

test('parseNoteRoute treats hash mode pages without route hash as root list route', () => {
  const route = parseNoteRoute(
    {
      pathname: '/demo-note/index.html',
      search: '?q=ignored',
      hash: '',
    },
    {
      IDFrameworkConfig: { noteRouteMode: 'hash' },
    },
  );

  assert.equal(route.path, '/');
  assert.equal(route.view, 'list');
  assert.deepEqual(route.query, {});
});

test('parseNoteRoute decodes note id params', () => {
  const route = parseNoteRoute({ hash: '#/note/a%2Fb' });
  assert.equal(route.view, 'detail');
  assert.equal(route.params.id, 'a/b');
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
