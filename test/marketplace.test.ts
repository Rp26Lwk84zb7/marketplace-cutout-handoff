import assert from "node:assert/strict";
import { test } from "node:test";
import { objectKey } from "../src/cutout_service.js";

test("a repeated listing revision targets the same buyer handoff object", () => {
  assert.equal(objectKey("seller7", "lamp42", "rev3"), "seller7/lamp42/rev3.png");
  assert.equal(objectKey("seller7", "lamp42", "rev3"), objectKey("seller7", "lamp42", "rev3"));
  assert.notEqual(objectKey("seller7", "lamp42", "rev4"), objectKey("seller7", "lamp42", "rev3"));
});
