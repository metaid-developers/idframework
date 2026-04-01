import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyNoteForm,
  normalizeNoteData,
  parseNoteSummary,
} from '../idframework/utils/note-adapter.js';
import {
  mergeNoteAttachments,
  resolveNoteCoverUrl,
} from '../idframework/utils/note-attachments.js';
import { replaceNoteAttachmentPlaceholders } from '../idframework/utils/note-markdown.js';

test('parseNoteSummary accepts JSON string contentSummary and returns normalized note shape', () => {
  const noteData = parseNoteSummary({
    id: 'pin-note-1',
    contentSummary: JSON.stringify({
      title: 'Demo Note',
      subtitle: 123,
      content: 'Hello note',
      coverImg: 'metafile://cover123.png',
      tags: ['demo', 42],
      attachments: ['metafile://file1.png', '', null],
    }),
  });

  assert.equal(noteData.title, 'Demo Note');
  assert.equal(noteData.subtitle, '123');
  assert.equal(noteData.content, 'Hello note');
  assert.equal(noteData.contentType, 'text/markdown');
  assert.equal(noteData.encryption, '0');
  assert.equal(noteData.coverImg, 'metafile://cover123.png');
  assert.deepEqual(noteData.tags, ['demo', '42']);
  assert.deepEqual(noteData.attachments, ['metafile://file1.png']);

  const empty = createEmptyNoteForm();
  assert.equal(empty.contentType, 'text/markdown');
  assert.deepEqual(empty.attachments, []);

  const normalized = normalizeNoteData('{"title":"Normalized","attachments":["metafile://one.png"]}');
  assert.equal(normalized.title, 'Normalized');
  assert.deepEqual(normalized.attachments, ['metafile://one.png']);
});

test('mergeNoteAttachments keeps retained refs and appends new upload URIs once', () => {
  const merged = mergeNoteAttachments(
    ['metafile://old-1.png', 'metafile://keep-2.pdf'],
    [
      { keep: false, value: 'metafile://old-1.png' },
      { keep: true, value: 'metafile://keep-2.pdf' },
      'metafile://new-3.jpg',
      'metafile://new-3.jpg',
      '',
    ]
  );

  assert.deepEqual(merged, [
    'metafile://keep-2.pdf',
    'metafile://new-3.jpg',
  ]);

  assert.equal(
    resolveNoteCoverUrl('metafile://cover123.png', {
      metafsBaseUrl: 'https://file.metaid.io/metafile-indexer/api/v1',
    }),
    'https://file.metaid.io/metafile-indexer/api/v1/files/content/cover123'
  );

  assert.equal(
    resolveNoteCoverUrl('https://cdn.example.com/file.png?token=abc#preview', {
      metafsBaseUrl: 'https://file.metaid.io/metafile-indexer/api/v1',
    }),
    'https://cdn.example.com/file.png?token=abc#preview'
  );

  assert.deepEqual(
    mergeNoteAttachments(
      ['metafile://stay-2.pdf', 'metafile://remove-1.png'],
      [
        { keep: false, value: 'metafile://remove-1' },
        'metafile://new-3.jpg',
      ]
    ),
    ['metafile://stay-2.pdf', 'metafile://new-3.jpg']
  );

  assert.deepEqual(
    mergeNoteAttachments(
      ['metafile://same-pin'],
      ['metafile://same-pin.png']
    ),
    ['metafile://same-pin']
  );
});

test('replaceNoteAttachmentPlaceholders replaces attachment tokens and metafile refs with resolved URLs', () => {
  const rendered = replaceNoteAttachmentPlaceholders(
    '![Cover]({{attachment-0}})\n\n[Inline](metafile://inline-2.pdf)',
    {
      attachments: ['metafile://cover-1.png'],
      resolveAttachmentUrl(attachment) {
        return resolveNoteCoverUrl(attachment, {
          metafsBaseUrl: 'https://file.metaid.io/metafile-indexer/api/v1',
        });
      },
    }
  );

  assert.equal(
    rendered,
    '![Cover](https://file.metaid.io/metafile-indexer/api/v1/files/content/cover-1)\n\n[Inline](https://file.metaid.io/metafile-indexer/api/v1/files/content/inline-2)'
  );
});
