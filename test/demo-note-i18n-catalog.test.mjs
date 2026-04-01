import test from 'node:test';
import assert from 'node:assert/strict';

import noteZh from '../demo-note/i18n/note.zh.js';
import noteEn from '../demo-note/i18n/note.en.js';

function getByPath(root, path) {
  return path.split('.').reduce((cursor, key) => (cursor && key in cursor ? cursor[key] : undefined), root);
}

test('note zh/en catalogs include nav, button, empty-state, and error-state keys used by components', () => {
  const requiredKeys = [
    'nav.public',
    'nav.my',
    'nav.draft',
    'nav.new',
    'card.untitled',
    'card.encrypted',
    'list.emptyTitle',
    'state.errorTitle',
    'detail.edit',
    'detail.attachments',
    'draft.open',
    'editor.publish',
    'editor.unsaved',
  ];

  requiredKeys.forEach((key) => {
    assert.equal(typeof getByPath(noteZh, key), 'string', 'missing zh key: ' + key);
    assert.equal(typeof getByPath(noteEn, key), 'string', 'missing en key: ' + key);
  });
});
