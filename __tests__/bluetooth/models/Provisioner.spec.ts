import { describe, expect, it } from "vitest";
import Provisioner from "../../../src/bluetooth/models/Provisioner";
describe("", () => {
  it("", () => {});
});

// describe("Provisioner test", () => {
// it("should make a provisioning invite proxy PDU successfully", () => {
//   const provisioner = new Provisioner();
//   const expected = "030000";
//   const computed = provisioner.makeInviteMessage();
//   expect(computed).toEqual(expected);
// });
// it("should make a provisioning start proxy PDU successfully", () => {
//   const provisioner = new Provisioner();
//   provisioner.__testSetNodeToProvision("01", "0001", "00", "00", "00", "0000", "00", "00");
//   const expected = "03020000000000";
//   const computed = provisioner.makeStartMessage();
//   expect(computed).toEqual(expected);
// });
// it("should make a provisioning public key proxy PDU successfully", () => {
//   const provisioner = new Provisioner();
//   const publicKey =
//     "2c31a47b5779809ef44cb5eaaf5c3e43d5f8faad4a8794cb987e9b03745c78dd919512183898dfbecd52e2408e43871fd021109117bd3ed4eaf8437743715d4f";
//   const expected =
//     "03032c31a47b5779809ef44cb5eaaf5c3e43d5f8faad4a8794cb987e9b03745c78dd919512183898dfbecd52e2408e43871fd021109117bd3ed4eaf8437743715d4f";
//   const computed = provisioner.makePublicKeyMessage(publicKey);
//   expect(computed).toEqual(expected);
// });
// });
