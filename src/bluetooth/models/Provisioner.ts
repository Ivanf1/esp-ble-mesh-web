import BluetoothManager from "../BluetoothManager";
import pduBuilder, { MessageType } from "../pduBuilder";

enum ProvisioningType {
  INVITE = "00",
  CAPABILITIES = "01",
  START = "02",
  PUBLIC_KEY = "03",
  INPUT_COMPLETE = "04",
  CONFIRMATION = "05",
  RANDOM = "06",
  DATA = "07",
  COMPLETE = "08",
}
interface ProvisionerProps {
  bluetoothManager: BluetoothManager;
}
class Provisioner {
  private nodeToProvision = {
    numberOfElements: "",
    algorithms: "",
    pubKeyType: "",
    staticOOBType: "",
    outputOOBSize: "",
    outputOOBAction: "",
    inputOOBSize: "",
    inputOOBAction: "",
  };
  private isProvisioning = false;
  private bluetoothManager: BluetoothManager;

  constructor(props: ProvisionerProps) {
    this.bluetoothManager = props.bluetoothManager;
  }

  // private waitAndSendMessage(message: string, waitTime: number) {
  //   setTimeout(() => {
  //     this.bluetoothManager.sendProxyPDU(message);
  //   }, waitTime);
  // }

  startProvisioningProcess() {
    if (this.isProvisioning) return;
    this.isProvisioning = true;

    const inviteMessage = this.makeInviteMessage();
    console.log("sending invite message");
    // this.waitAndSendMessage(inviteMessage, 3000);
    this.bluetoothManager.sendProxyPDU(inviteMessage);
  }

  makeInviteMessage(): string {
    return pduBuilder.finalizeProxyPDU("0000", MessageType.PROVISIONING);
  }

  /**
   * Refer to Mesh Profile Specification 5.4.1.3.
   */
  makeStartMessage() {
    if (!this.isProvisioning) return;

    // No OOB authentication is used.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.28.
    const authenticationMethod = "00";

    // Blink. Even if we do not use an authentication method we
    // have to specify this field.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.29.
    const authenticationAction = "00";

    // Even if we do not use an authentication method we
    // have to specify this field.
    // Refer to Mesh Specification Profile 5.4.1.3 table 5.30.
    const authenticationSize = "00";

    const pdu =
      ProvisioningType.START +
      this.nodeToProvision.algorithms.substring(0, 2) +
      this.nodeToProvision.pubKeyType +
      authenticationMethod +
      authenticationAction +
      authenticationSize;

    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  makePublicKeyMessage(publicKey: string) {
    if (!this.isProvisioning) return;

    const pdu = ProvisioningType.PUBLIC_KEY + publicKey;
    return pduBuilder.finalizeProxyPDU(pdu, MessageType.PROVISIONING);
  }

  parseProvisionerPDU(pdu: string) {
    if (!this.isProvisioning) return;

    console.log(`received provisioning message ${pdu}`);

    const provisioningType = pdu.substring(0, 2) as ProvisioningType;
    const data = pdu.substring(2);

    switch (provisioningType) {
      case ProvisioningType.CAPABILITIES:
        console.log("received capabilities");
        this.parseCapabilitiesPDU(data);

        const startMessage = this.makeStartMessage();
        console.log("sending start message");
        this.bluetoothManager.sendProxyPDU(startMessage!);
        break;

      default:
        break;
    }
  }

  /**
   * Refer to Mesh Profile Specification 5.4.1.2.
   */
  private parseCapabilitiesPDU(pdu: string) {
    this.nodeToProvision.numberOfElements = pdu.substring(0, 2);
    this.nodeToProvision.algorithms = pdu.substring(2, 6);
    this.nodeToProvision.pubKeyType = pdu.substring(6, 8);
    this.nodeToProvision.staticOOBType = pdu.substring(8, 10);
    this.nodeToProvision.outputOOBSize = pdu.substring(10, 12);
    this.nodeToProvision.outputOOBAction = pdu.substring(12, 16);
    this.nodeToProvision.inputOOBSize = pdu.substring(16, 18);
    this.nodeToProvision.inputOOBAction = pdu.substring(18, pdu.length);

    console.log(this.nodeToProvision);
  }

  __testSetNodeToProvision(
    numberOfElements: string,
    algorithms: string,
    pubKeyType: string,
    staticOOBType: string,
    outputOOBSize: string,
    outputOOBAction: string,
    inputOOBSize: string,
    inputOOBAction: string
  ) {
    this.nodeToProvision.numberOfElements = numberOfElements;
    this.nodeToProvision.algorithms = algorithms;
    this.nodeToProvision.pubKeyType = pubKeyType;
    this.nodeToProvision.staticOOBType = staticOOBType;
    this.nodeToProvision.outputOOBSize = outputOOBSize;
    this.nodeToProvision.outputOOBAction = outputOOBAction;
    this.nodeToProvision.inputOOBSize = inputOOBSize;
    this.nodeToProvision.inputOOBAction = inputOOBAction;
  }
}

export default Provisioner;
