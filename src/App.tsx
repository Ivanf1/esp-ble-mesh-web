import { useRef, useState } from "react";
import BluetoothManager from "./bluetooth/BluetoothManager";
import GenericOnOffClient from "./bluetooth/models/GenericOnOffClient";
import ProxyConfigurationClient from "./bluetooth/models/ProxyConfigurationClient";
import { ParsedProxyPDU } from "./bluetooth/pduParser";
import { CONFIGURATION_API } from "./constants/bluetooth";

const bluetoothManager = new BluetoothManager({
  meshConfigurationServerUrl: CONFIGURATION_API,
  meshConfigurationId: "1",
});
await bluetoothManager.initialize();

function App() {
  const connectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const ledStatusRef = useRef<HTMLParagraphElement | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [onOffClient, setOnOffClient] = useState<GenericOnOffClient | null>(null);
  const [proxyConfigurationClient, setProxyConfigurationClient] =
    useState<ProxyConfigurationClient | null>(null);

  const handleConnection = async () => {
    if (connected) {
      bluetoothManager.disconnect();
      return;
    }

    const conn = await bluetoothManager.connect();
    if (conn) {
      setConnected(true);
      bluetoothManager.registerProxyPDUNotificationCallback(onProxyMessageReceived);
      bluetoothManager.registerDisconnectedCallback(onDisconnected);
      if (connectionButtonRef.current) {
        connectionButtonRef.current.innerHTML = "disconnect";
      }

      const onOffClient = new GenericOnOffClient({
        ...bluetoothManager.getConfiguration(),
      });
      setOnOffClient(onOffClient);
      const proxyConfigurationClient = new ProxyConfigurationClient({
        ...bluetoothManager.getConfiguration(),
      });

      setProxyConfigurationClient(proxyConfigurationClient);
      const blacklistFilterPDU = proxyConfigurationClient.makeBlacklistFilterPDU(
        bluetoothManager.getCurrentSeq()
      );
      bluetoothManager.sendProxyPDU(blacklistFilterPDU);
    }
  };

  const onProxyMessageReceived = (proxyPDU: ParsedProxyPDU) => {
    console.log(proxyPDU);
    if (ledStatusRef.current) {
      const paramsInt = parseInt(proxyPDU.params);
      ledStatusRef.current.innerHTML = paramsInt ? "ON" : "OFF";
    }
  };

  const sendMessage = (onOff: boolean) => {
    if (!connected || !onOffClient) return;
    const proxyPUD = onOffClient.makeSetUnackMessage(
      onOff,
      "c000",
      bluetoothManager.getCurrentSeq()
    );
    bluetoothManager.sendProxyPDU(proxyPUD);
  };

  const onDisconnected = (e: Event) => {
    console.log(e);
    setConnected(false);
    if (connectionButtonRef.current) {
      connectionButtonRef.current.innerHTML = "connect";
    }
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
