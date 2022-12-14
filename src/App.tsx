import { useState } from "react";
import bluetooth from "./services/bluetooth/bluetooth";

function App() {
  const [dataIn, setDataIn] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  const connect = async () => {
    bluetooth.initialize();
    const device = await bluetooth.scanForProxyNode();
    if (device) {
      const server = await bluetooth.connect(device);
      if (server) {
        console.log("Connected");

        const result = await bluetooth.getMeshProxyDataInDataOutCharacteristics(server);

        if (result) {
          console.log("proxy characteristics found");
          const [dataIn, _] = result;
          setDataIn(dataIn);
        }
      }
    }
  };

  const sendMessage = (onOff: boolean) => {
    if (!dataIn) return;
    const proxyPDU = bluetooth.makeProxyPDU(onOff);
    bluetooth.sendProxyPDU(proxyPDU, dataIn!);
  };

  return (
    <div className="App">
      <div className="flex justify-around mt-10">
        <button onClick={connect}>connect</button>
        <button onClick={() => sendMessage(true)}>on</button>
        <button onClick={() => sendMessage(false)}>off</button>
      </div>
    </div>
  );
}

export default App;
