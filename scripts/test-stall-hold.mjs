import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStallHold } from '../js/market/stall-hold.js';

test('a short press does not enter; a full hold enters only once until release', () => {
  const hold = createStallHold();
  hold.press('enter:tea', 0);
  assert.equal(hold.update('enter:tea', 300), false);
  assert.equal(hold.progress, .5);
  hold.release();
  assert.equal(hold.update('enter:tea', 700), false);
  hold.press('enter:tea', 1000);
  assert.equal(hold.update('enter:tea', 1600), true);
  hold.press('exit:tea', 1700); // OS key repeat must not reverse the completed action.
  assert.equal(hold.update('exit:tea', 2500), false);
  hold.release();
  hold.press('exit:tea', 3000);
  assert.equal(hold.update('exit:tea', 3600), true);
});

test('moving away or switching stalls cancels and requires releasing E', () => {
  const hold = createStallHold();
  hold.press('enter:tea', 0);
  assert.equal(hold.update('enter:toys', 400), false);
  assert.equal(hold.progress, 0);
  hold.press('enter:toys', 500);
  assert.equal(hold.update('enter:toys', 1400), false);
  hold.release();
  hold.press('enter:toys', 1500);
  assert.equal(hold.update(null, 1600), false);
  assert.equal(hold.update('enter:toys', 2500), false);
});

test('dialogs and camera transitions cancel; a fresh press works after focus returns', () => {
  const hold = createStallHold();
  hold.press('exit:fans', 0);
  hold.update('exit:fans', 400);
  hold.cancel();
  assert.equal(hold.update('exit:fans', 700), false);
  hold.release();
  hold.press(null, 1000); // No shop was available when the key went down.
  assert.equal(hold.update('enter:fans', 2000), false);
  hold.release();
  hold.press('enter:fans', 2100);
  assert.equal(hold.update('enter:fans', 2700), true);
});
