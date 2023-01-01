import { describe, it, expect } from "vitest";
import utils from "../../src/utils/utils";

describe("utils test", () => {
  describe("toHex test", () => {
    it("should return the correct hex representation", () => {
      const expected = "0f";
      const computed = utils.toHex(15, 1);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "000f";
      const computed = utils.toHex(15, 2);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "00000f";
      const computed = utils.toHex(15, 3);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "12";
      const computed = utils.toHex(18, 1);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "0012";
      const computed = utils.toHex(18, 2);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "000012";
      const computed = utils.toHex(18, 3);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "01ec";
      const computed = utils.toHex(492, 2);

      expect(computed).toEqual(expected);
    });

    it("should return the correct hex representation", () => {
      const expected = "0001ec";
      const computed = utils.toHex(492, 3);

      expect(computed).toEqual(expected);
    });
  });

  describe("swap endianness test", () => {
    it("should return the hex string correctly swapped", () => {
      const str = "0004";

      const expected = "0400";
      const computed = utils.swapHexEndianness(str);

      expect(computed).toEqual(expected);
    });
    it("should return the hex string correctly swapped", () => {
      const str = "1000";

      const expected = "0010";
      const computed = utils.swapHexEndianness(str);

      expect(computed).toEqual(expected);
    });
  });
});
