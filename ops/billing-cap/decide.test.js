import assert from 'node:assert/strict';
import { capFrom, shouldCut } from './decide.js';

assert.equal(capFrom({}), 150);
assert.equal(capFrom({ CAP_AMOUNT: '180' }), 180);
assert.equal(capFrom({ CAP_AMOUNT: 'abc' }), 150);
assert.equal(capFrom({ CAP_AMOUNT: '0' }), 150);
assert.equal(shouldCut({ costAmount: 12.5, budgetAmount: 200 }, 150), false);
assert.equal(shouldCut({ costAmount: 149.99 }, 150), false);
assert.equal(shouldCut({ costAmount: 150 }, 150), true);
assert.equal(shouldCut({ costAmount: 240 }, 150), true);
assert.equal(shouldCut({}, 150), false);
assert.equal(shouldCut(null, 150), false);
assert.equal(shouldCut({ costAmount: 'NaN' }, 150), false);
console.log('decide: all checks pass');
