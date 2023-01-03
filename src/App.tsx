import { on } from "events";
import { useRef, useState } from "react";
import BluetoothManager from "./bluetooth/BluetoothManager";
import MeshConfigurationManager from "./bluetooth/MeshConfigurationManager";
import ConfigClient from "./bluetooth/models/ConfigClient";
import GenericOnOffClient from "./bluetooth/models/GenericOnOffClient";
import Provisioner from "./bluetooth/models/Provisioner";
import ProxyConfigurationClient from "./bluetooth/models/ProxyConfigurationClient";
// import { ParsedProxyPDU } from "./bluetooth/PduParser";
import { CONFIGURATION_API } from "./constants/bluetooth";

const meshConfigurationManager = new MeshConfigurationManager({
  meshConfigurationServerUrl: CONFIGURATION_API,
  meshConfigurationId: "1",
});
meshConfigurationManager.initialize();
const bluetoothManager = new BluetoothManager({
  meshConfigurationManager,
});
const provisioner = new Provisioner({ bluetoothManager, meshConfigurationManager });
const configClient = new ConfigClient({ bluetoothManager, meshConfigurationManager });

// await bluetoothManager.initialize();
const onOffClient = new GenericOnOffClient({
  ...bluetoothManager.getConfiguration(),
  meshConfigurationManager,
});
const proxyConfigurationClient = new ProxyConfigurationClient({
  ...bluetoothManager.getConfiguration(),
});

function App() {
  const connectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const ledStatusRef = useRef<HTMLParagraphElement | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const handleConnection = async () => {
    if (connected) {
      bluetoothManager.disconnect();
      return;
    }

    const conn = await bluetoothManager.connect("proxy");
    if (conn) {
      setConnected(true);
      // bluetoothManager.registerProxyPDUNotificationCallback(onProxyMessageReceived);
      // bluetoothManager.registerDisconnectedCallback(onDisconnected);
      if (connectionButtonRef.current) {
        connectionButtonRef.current.innerHTML = "disconnect";
      }
      console.log("config client call");
      configClient.addAppKey("0002");

      // const blacklistFilterPDU = proxyConfigurationClient.makeBlacklistFilterPDU(
      //   bluetoothManager.getCurrentSeq()
      // );
      // bluetoothManager.sendProxyPDU(blacklistFilterPDU);
    }
  };

  const handleProvision = async () => {
    const conn = await bluetoothManager.connect("provisioning");

    if (conn) {
      // bluetoothManager.registerProxyPDUNotificationCallback(onProxyMessageReceived);
      bluetoothManager.registerDisconnectedCallback(onDisconnected);
      // bluetoothManager.sendProxyPDU(provisioner.makeInviteMessage());
      provisioner!.startProvisioningProcess(onProvisioningCompleted);
    }
  };

  const onProxyMessageReceived = (proxyPDU: string) => {
    console.log(proxyPDU);
    if (ledStatusRef.current) {
      // const paramsInt = parseInt(proxyPDU.params);
      // ledStatusRef.current.innerHTML = paramsInt ? "ON" : "OFF";
    }
  };

  const sendMessage = (onOff: boolean) => {
    if (onOff) {
      configClient.modelAppKeyBind("0002", "0003", "1000");
    } else {
      configClient.modelPublicationSet("0002", "0003", "c000", "1000");
    }
    // configClient.getCompositionData("0003", "00", devKey);
    // configClient.parseCompositionData(
    //   "00646b11fef156b29313fdbc57bc9873fde4570883b9ecc787ad75f3376a"
    // );
    // configClient.parseCompositionData(
    //   "00647f3607f71ebf72ed682f818428f6a17e688ea4a159e9bea19438565d"
    // );
    // configClient.parseCompositionData(
    //   "00644aa799687f28773c2b98b6975d90569cd18fc906daed172d1931dc79"
    // );
    // configClient.parseCompositionData("0064155dd09a1db400838c5be6efaa436a6acf2a654a");
    // if (!connected) return;
    // const proxyPUD = onOffClient.makeSetUnackMessage(
    //   onOff,
    //   "c000",
    //   bluetoothManager.getCurrentSeq()
    // );
    // bluetoothManager.sendProxyPDU(proxyPUD);
    // provisioner.makeConfigAppKeyAdd();
  };

  const onDisconnected = (_: Event) => {
    setConnected(false);
    if (connectionButtonRef.current) {
      connectionButtonRef.current.innerHTML = "connect";
    }
  };

  const onProvisioningCompleted = (devKey: string) => {
    bluetoothManager.disconnect();
  };

  return (
    <div className="App">
      <div className="flex justify-around mt-10">
        <button
          className="mt-4 px-8 py-2 rounded-md text-white bg-blue-600"
          onClick={handleConnection}
          ref={connectionButtonRef}
        >
          connect
        </button>
        <button
          className="mt-4 px-8 py-2 rounded-md text-white bg-blue-600"
          onClick={handleProvision}
        >
          provision
        </button>
        <button
          className="mt-4 px-8 py-2 rounded-md text-white bg-green-600"
          onClick={() => sendMessage(true)}
        >
          on
        </button>
        <button
          className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
          onClick={() => sendMessage(false)}
        >
          off
        </button>
        <button
          className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
          onClick={() => configClient.modelSubscriptionAdd("0002", "0003", "c001", "1000")}
        >
          off
        </button>
        <p ref={ledStatusRef}></p>
      </div>
    </div>
  );
}

export default App;
