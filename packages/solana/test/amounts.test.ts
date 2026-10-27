import test from 'node:test';
import assert from 'node:assert/strict';
import { U64_MAX,parseBaseUnits,splitPayment,decimalToBaseUnits,formatBaseUnits } from '../src/amounts.js';
test('integer token parsing preserves u64 values',()=>{assert.equal(parseBaseUnits('18446744073709551615'),U64_MAX);for(const value of ['18446744073709551616','1e6','-1','1.5','Infinity','NaN','00'])assert.throws(()=>parseBaseUnits(value));});
test('fees round down without dropping base units',()=>{for(const amount of [0n,1n,9n,10n,999n,U64_MAX]){const s=splitPayment(amount);assert.equal(s.seller+s.fee,amount);assert.equal(s.fee,amount/10n);}assert.throws(()=>splitPayment(U64_MAX+1n));assert.throws(()=>splitPayment(100n,10001));});
test('decimal conversion uses exact integers and validated mint precision',()=>{assert.equal(decimalToBaseUnits('9007199254.740993',6),9007199254740993n);assert.equal(formatBaseUnits(9007199254740993n,6),'9007199254.740993');assert.equal(decimalToBaseUnits('0.000001',6),1n);assert.throws(()=>decimalToBaseUnits('1.0000001',6));assert.throws(()=>decimalToBaseUnits('1',-1));});
