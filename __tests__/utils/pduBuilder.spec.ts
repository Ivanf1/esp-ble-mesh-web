import { describe, it, expect } from "vitest";
import pduBuilder from "../../src/bluetooth/pduBuilder";

describe("PDU builder test", () => {
  describe("access payload test", () => {
    it("should make the Access Payload correctly", () => {
      const opCode = "8203"; // set unack
      const onOff = "00"; // off

      const expected = opCode + onOff;
      const computed = pduBuilder.makeAccessPayload(opCode, onOff);

      expect(computed).toEqual(expected);
    });
  });

  describe("application nonce test", () => {
    it("should make the Application nonce correctly", () => {
      const expectedSeq = "000001";
      const src = "0003";
      const dst = "c000";
      const ivIndex = "00000000";

      const seq = 1;
      const expected = "0100" + expectedSeq + src + dst + ivIndex;
      const computed = pduBuilder.makeApplicationNonce(seq, src, dst, ivIndex);

      expect(computed).toEqual(expected);
    });
  });
});
