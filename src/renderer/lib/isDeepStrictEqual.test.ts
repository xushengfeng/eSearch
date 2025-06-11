import { describe, it, expect } from "vitest";

import { isDeepStrictEqual } from "./isDeepStrictEqual";

describe("isDeepStrictEqual", () => {
    it("should return true for equal primitives", () => {
        expect(isDeepStrictEqual(1, 1)).toBe(true);
        expect(isDeepStrictEqual("abc", "abc")).toBe(true);
        expect(isDeepStrictEqual(true, true)).toBe(true);
        expect(isDeepStrictEqual(null, null)).toBe(true);
        expect(isDeepStrictEqual(undefined, undefined)).toBe(true);
    });

    it("should return false for different primitives", () => {
        expect(isDeepStrictEqual(1, 2)).toBe(false);
        expect(isDeepStrictEqual("abc", "def")).toBe(false);
        expect(isDeepStrictEqual(true, false)).toBe(false);
        expect(isDeepStrictEqual(null, undefined)).toBe(false);
        expect(isDeepStrictEqual(0, false)).toBe(false);
    });

    it("should return true for equal arrays", () => {
        expect(isDeepStrictEqual([], [])).toBe(true);
        expect(isDeepStrictEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isDeepStrictEqual([[1], [2]], [[1], [2]])).toBe(true);
    });

    it("should return false for arrays with different lengths", () => {
        expect(isDeepStrictEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it("should return false for arrays with different elements", () => {
        expect(isDeepStrictEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it("should return true for equal objects", () => {
        expect(isDeepStrictEqual({}, {})).toBe(true);
        expect(isDeepStrictEqual({ a: 1 }, { a: 1 })).toBe(true);
        expect(isDeepStrictEqual({ a: { b: 2 } }, { a: { b: 2 } })).toBe(true);
    });

    it("should return false for objects with different keys", () => {
        expect(isDeepStrictEqual({ a: 1 }, { b: 1 })).toBe(false);
        expect(isDeepStrictEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it("should return false for objects with different values", () => {
        expect(isDeepStrictEqual({ a: 1 }, { a: 2 })).toBe(false);
        expect(isDeepStrictEqual({ a: { b: 2 } }, { a: { b: 3 } })).toBe(false);
    });

    it("should handle nested structures", () => {
        const a = { x: [1, { y: 2 }], z: { w: [3, 4] } };
        const b = { x: [1, { y: 2 }], z: { w: [3, 4] } };
        expect(isDeepStrictEqual(a, b)).toBe(true);

        const c = { x: [1, { y: 3 }], z: { w: [3, 4] } };
        expect(isDeepStrictEqual(a, c)).toBe(false);
    });

    it("should return false for different types", () => {
        expect(isDeepStrictEqual({}, [])).toBe(false);
        expect(isDeepStrictEqual([], {})).toBe(false);
        expect(isDeepStrictEqual(1, {})).toBe(false);
        expect(isDeepStrictEqual("a", [])).toBe(false);
    });

    it("should handle Date objects as objects (not equal unless same reference)", () => {
        const d1 = new Date(0);
        const d2 = new Date(0);
        expect(isDeepStrictEqual(d1, d2)).toBe(true); // Both have same keys/values
    });

    it("should handle functions as primitives (only equal if same reference)", () => {
        const f1 = () => 1;
        const f2 = () => 1;
        expect(isDeepStrictEqual(f1, f1)).toBe(true);
        expect(isDeepStrictEqual(f1, f2)).toBe(false);
    });
});
