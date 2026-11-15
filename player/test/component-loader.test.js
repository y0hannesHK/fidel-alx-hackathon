// fidel.js loads fidel-components.js only for pages that use a component tag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentFileUrls, CORE_TAGS } from '../src/component-loader.js';

test('the components file is found next to fidel.js', () => {
  assert.deepEqual(componentFileUrls('https://fidel.example/embed/v1/fidel.js?v=2#x'), {
    script: 'https://fidel.example/embed/v1/fidel-components.js',
    style: 'https://fidel.example/embed/v1/fidel-components.css',
  });
});

test('the player, job card, session viewer and certificate are in fidel.js itself', () => {
  assert.deepEqual([...CORE_TAGS].sort(), ['fidel-certificate', 'fidel-job-card', 'fidel-player', 'fidel-session-viewer']);
});
