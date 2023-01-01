import { useRef, useState } from "react";
import BluetoothManager from "./bluetooth/BluetoothManager";
import ConfigClient from "./bluetooth/models/ConfigClient";
import GenericOnOffClient from "./bluetooth/models/GenericOnOffClient";
import Provisioner from "./bluetooth/models/Provisioner";
import ProxyConfigurationClient from "./bluetooth/models/ProxyConfigurationClient";
import { ParsedProxyPDU } from "./bluetooth/pduParser";
import { CONFIGURATION_API } from "./constants/bluetooth";

const bluetoothManager = new BluetoothManager({
  meshConfigurationServerUrl: CONFIGURATION_API,
  meshConfigurationId: "1",
});
const provisioner = new Provisioner({ bluetoothManager });
const configClient = new ConfigClient({ bluetoothManager });

// await bluetoothManager.initialize();
const onOffClient = new GenericOnOffClient({
  ...bluetoothManager.getConfiguration(),
});
const proxyConfigurationClient = new ProxyConfigurationClient({
  ...bluetoothManager.getConfiguration(),
});

function App() {
  const connectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const ledStatusRef = useRef<HTMLParagraphElement | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [devKey, setDevKey] = useState<string>("");

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
      configClient.addAppKey("0003", devKey);

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
    setDevKey(devKey);
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
        <p ref={ledStatusRef}></p>
      </div>
    </div>
  );
}

export default App;
