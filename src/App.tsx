import { useRef, useState } from "react";
import BluetoothManager from "./bluetooth/BluetoothManager";
import MeshConfigurationManager from "./bluetooth/MeshConfigurationManager";
import ConfigClient from "./bluetooth/models/ConfigClient";
import GenericOnOffClient from "./bluetooth/models/GenericOnOffClient";
import Provisioner, { ProvisioningStatus } from "./bluetooth/models/Provisioner";
import ProxyConfigurationClient from "./bluetooth/models/ProxyConfigurationClient";
// import { ParsedProxyPDU } from "./bluetooth/PduParser";
import { CONFIGURATION_API } from "./constants/bluetooth";
import Sidemenu from "./components/Sidemenu";
import { Outlet } from "react-router-dom";

// const meshConfigurationManager = new MeshConfigurationManager({
//   meshConfigurationServerUrl: CONFIGURATION_API,
//   meshConfigurationId: "1",
// });
// meshConfigurationManager.initialize();
// const bluetoothManager = new BluetoothManager({
//   meshConfigurationManager,
// });

// const provisioner = new Provisioner({ bluetoothManager, meshConfigurationManager });
// const configClient = new ConfigClient({ bluetoothManager, meshConfigurationManager });
// const onOffClient = new GenericOnOffClient({ bluetoothManager, meshConfigurationManager });
// const proxyConfigurationClient = new ProxyConfigurationClient({
//   bluetoothManager,
//   meshConfigurationManager,
// });

interface Props {
  configClient: ConfigClient;
}
function App({ configClient }: Props) {
  const connectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const ledStatusRef = useRef<HTMLParagraphElement | null>(null);
  const [connected, setConnected] = useState<boolean>(false);

  const handleConnection = async () => {
    // if (connected) {
    //   bluetoothManager.disconnect();
    //   return;
    // }
    // const conn = await bluetoothManager.connect("proxy");
    // if (conn) {
    //   setConnected(true);
    //   // bluetoothManager.registerProxyPDUNotificationCallback(onProxyMessageReceived);
    //   // bluetoothManager.registerDisconnectedCallback(onDisconnected);
    //   if (connectionButtonRef.current) {
    //     connectionButtonRef.current.innerHTML = "disconnect";
    //   }
    //   // configClient.addAppKey("0002");
    //   // const blacklistFilterPDU = proxyConfigurationClient.makeBlacklistFilterPDU(
    //   //   bluetoothManager.getCurrentSeq()
    //   // );
    //   // bluetoothManager.sendProxyPDU(blacklistFilterPDU);
    // }
  };

  const handleProvision = async () => {
    // const conn = await bluetoothManager.connect("provisioning");
    // if (conn) {
    //   // bluetoothManager.registerProxyPDUNotificationCallback(onProxyMessageReceived);
    //   bluetoothManager.registerDisconnectedCallback(onDisconnected);
    //   // bluetoothManager.sendProxyPDU(provisioner.makeInviteMessage());
    //   provisioner!.startProvisioningProcess(onProvisioningResult);
    // }
  };

  const onProxyMessageReceived = (proxyPDU: string) => {
    console.log(proxyPDU);
    if (ledStatusRef.current) {
      // const paramsInt = parseInt(proxyPDU.params);
      // ledStatusRef.current.innerHTML = paramsInt ? "ON" : "OFF";
    }
  };

  const sendMessage = (onOff: boolean) => {
    // if (onOff) {
    //   configClient.modelAppKeyBind("0002", "0003", "1000");
    // } else {
    //   configClient.modelPublicationSet("0002", "0003", "c000", "1000");
    // }
    // configClient.getCompositionData("0003", "00", devKey);
    // bluetoothManager.sendProxyPDU(proxyPUD);
    // provisioner.makeConfigAppKeyAdd();
  };

  const onDisconnected = (_: Event) => {
    setConnected(false);
    if (connectionButtonRef.current) {
      connectionButtonRef.current.innerHTML = "connect";
    }
  };

  const onProvisioningResult = (result: ProvisioningStatus) => {
    // bluetoothManager.disconnect();
  };

  // return (
  //   <div className="App">
  //     <div className="flex justify-around mt-10">
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-blue-600"
  //         onClick={handleConnection}
  //         ref={connectionButtonRef}
  //       >
  //         connect
  //       </button>
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-blue-600"
  //         onClick={handleProvision}
  //       >
  //         provision
  //       </button>
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-green-600"
  //         onClick={() => configClient.addAppKey("0002")}
  //       >
  //         server add app key
  //       </button>
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-green-600"
  //         onClick={() => configClient.addAppKey("0005")}
  //       >
  //         client add app key
  //       </button>
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
  //         onClick={() => configClient.modelAppKeyBind("0002", "0003", "1000")}
  //       >
  //         bind server
  //       </button>
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
  //         onClick={() => configClient.modelAppKeyBind("0005", "0005", "1001")}
  //       >
  //         bind client
  //       </button>
  // <button
  //   className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
  //   onClick={() => configClient.modelSubscriptionAdd("0002", "0003", "c000", "1000")}
  // >
  //   sub add
  // </button>;
  //       <button
  //         className="mt-4 px-8 py-2 rounded-md text-white bg-red-600"
  //         onClick={() => configClient.modelPublicationSet("0005", "0005", "c000", "1001")}
  //       >
  //         pub set
  //       </button>
  //       <p ref={ledStatusRef}></p>
  //     </div>
  //   </div>
  // );

  return (
    <>
      <Sidemenu />
      <div className="ml-[260px] min-h-screen flex">
        <main className="min-w-full px-5 2xl:px-0">
          {/* <div className="min-h-full max-w-7xl mx-auto pt-16"> */}
          <Outlet />
          {/* </div> */}
        </main>
      </div>
    </>
  );
}

export default App;
