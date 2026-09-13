// Run: node --experimental-strip-types --test src/lib/sponsor/memo.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSponsorId, newSponsorId, parseMemo } from "./memo.ts";

const ID = "bsp_0123456789abcdef";

test("sponsor bid memo, with the [len] prefix and a form-decoded '+'", () => {
  assert.deepEqual(parseMemo(`BINGKAI ${ID}`), { kind: "bid", sponsorId: ID });
  assert.deepEqual(parseMemo(`[24] BINGKAI ${ID}`), { kind: "bid", sponsorId: ID });
  assert.deepEqual(parseMemo(`BINGKAI+${ID}`), { kind: "bid", sponsorId: ID });
});

test("tip memo, any case", () => {
  assert.deepEqual(parseMemo("bingkai tip"), { kind: "tip" });
  assert.deepEqual(parseMemo("BINGKAI+TIP"), { kind: "tip" });
});

test("Portabase and PumpBid memos are never credited here", () => {
  assert.equal(parseMemo("PORTABASE TIP"), null);
  assert.equal(parseMemo("PORTABASE psp_0123456789abcdef"), null);
  assert.equal(parseMemo("BINGKAI psp_0123456789abcdef"), null);
  assert.equal(parseMemo("BID 9utfHAwb8ZqasYygd9keiFNqyTTB91wzT3dvvJcTbSyP"), null);
  assert.equal(parseMemo("BID cstm_0123456789abcdef"), null);
});

test("malformed or extra text is rejected", () => {
  assert.equal(parseMemo("BINGKAI bsp_xyz"), null);
  assert.equal(parseMemo(`BINGKAI ${ID} extra`), null);
  assert.equal(parseMemo("hello BINGKAI TIP"), null);
  assert.equal(parseMemo(null), null);
});

test("generated ids are valid and never look like another product's memo", () => {
  for (let i = 0; i < 50; i++) {
    const id = newSponsorId();
    assert.ok(isSponsorId(id));
    const memo = `BINGKAI ${id}`;
    assert.ok(!/BID|PORTABASE/i.test(memo));
  }
});
