import { describe, it, expect } from "vitest";
import pduBuilder from "../../src/bluetooth/pduBuilder";
import utils from "../../src/utils/utils";

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

  describe("network nonce test", () => {
    it("should make the Network nonce correctly", () => {
      const ctl = "00";
      const ttl = "04";
      const seq = 3221931;
      const src = "0003";
      const ivIndex = "12345678";

      const expected = "00043129ab0003000012345678";
      const computed = pduBuilder.makeNetworkNonce(ctl, ttl, seq, src, ivIndex);

      expect(computed).toEqual(expected);
    });
  });

  describe("bit test", () => {
    it("should bit", () => {
      const computedSeqZero = utils.getLastXBits(3221931, 13).toString(16);
      const expectedSeqZero = "9ab";
      expect(computedSeqZero).toEqual(expectedSeqZero);

      const computedSegO2 = utils.getFirstXBits(1, 2);
      const expectedSegO2 = 0;
      expect(computedSegO2).toEqual(expectedSegO2);

      const computedOctet1_octet2 = (
        utils.getFirstXBits(utils.getLastXBits(3221931, 13) << 2, 14) | computedSegO2
      ).toString(16);
      const expectedOctet1_octet2 = "26ac";
      expect(computedOctet1_octet2).toEqual(expectedOctet1_octet2);

      const computedOctet3 = (utils.getLastXBits(computedSegO2, 3) << 5) | 1;
      const expectedOctet3 = 1;
      expect(computedOctet3).toEqual(expectedOctet3);
    });
  });

  describe("segmented lower transport pdu", () => {
    it("should make a segmented lower transport pdu correctly", () => {
      const AID = "00";
      const upperTransportPDU = "ee9dddfd2169326d23f3afdf";
      const isAppKey = false;
      const seq = 3221931;
      const segO = 0;
      const segN = 1;

      const expected = "8000ac01ee9dddfd2169326d23f3afdf";
      const computed = pduBuilder.makeSegmentedLowerTransportPDU({
        AID,
        upperTransportPDU,
        isAppKey,
        seq,
        segO,
        segN,
      });
      expect(computed).toEqual(expected);
    });

    it("should make a segmented lower transport pdu correctly", () => {
      const AID = "00";
      const upperTransportPDU = "cfdc18c52fdef772e0e17308";
      const isAppKey = false;
      const seq = 3221931;
      const segO = 1;
      const segN = 1;

      const expected = "8000ac21cfdc18c52fdef772e0e17308";
      const computed = pduBuilder.makeSegmentedLowerTransportPDU({
        AID,
        upperTransportPDU,
        isAppKey,
        seq,
        segO,
        segN,
      });
      expect(computed).toEqual(expected);
    });
  });
});
