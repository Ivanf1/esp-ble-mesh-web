import { useRef, useState } from "react";
import bluetooth from "./bluetooth/bluetooth";
import { ParsedProxyPDU } from "./bluetooth/pduParser";

bluetooth.initialize();

function App() {
  const [dataIn, setDataIn] = useState<BluetoothRemoteGATTCharacteristic | null>(null);
  const [currentDevice, setCurrentDevice] = useState<BluetoothDevice | null>(null);
  const connectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const ledStatusRef = useRef<HTMLParagraphElement | null>(null);

  const handleConnection = async () => {
    if (currentDevice) {
      currentDevice.gatt?.disconnect();
      return;
    }

    const device = await bluetooth.scanForProxyNode();
    if (device) {
      const server = await bluetooth.connect(device);

      if (server) {
        console.log("Connected");

        const result = await bluetooth.getMeshProxyDataInDataOutCharacteristics(server);

        if (result) {
          console.log("proxy characteristics found");
          const [dataIn, dataOut] = result;
          setCurrentDevice(device);
          setDataIn(dataIn);
          bluetooth.registerProxyPDUNotificationCallback(dataOut, onProxyMessageReceived);
          device.addEventListener("gattserverdisconnected", onDisconnected);
          if (connectionButtonRef.current) {
            connectionButtonRef.current.innerHTML = "disconnect";
          }
        }
      }
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
    if (!dataIn) return;
    const proxyPDU = bluetooth.makeProxyPDU(onOff);
    bluetooth.sendProxyPDU(proxyPDU, dataIn!);
  };

  const onDisconnected = () => {
    setCurrentDevice(null);
    setDataIn(null);
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
