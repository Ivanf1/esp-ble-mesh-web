import { useNavigate } from "react-router-dom";
import DeviceSettings from "./components/DeviceSettings";

const Settings = () => {
  const navigate = useNavigate();

  const onElementSelected = (elementNumber: number) => {
    navigate(`element/${elementNumber}`);
  };

  return (
    <>
      <h2 className="mb-16">Device</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <DeviceSettings onElementSelected={onElementSelected} />
        </div>
        <div>
          <div>
            <h5 className="mb-3">Composition Data</h5>
            <div className="p-4 rounded-lg border-solid border-2 border-border grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <span className="font-medium">Name:</span>
              <span>name</span>
              <span className="font-medium">Id:</span>
              <span>id</span>
              <span className="font-medium">Unicast Address:</span>
              <span>unicastAddress</span>
              <span className="font-medium">TTL:</span>
              <span>ttl</span>
              <span className="font-medium">Device Key:</span>
              <span>deviceKey</span>
              <span className="font-medium">Company Identifier</span>
              <span>companyId</span>
              <span className="font-medium">Product Identifier:</span>
              <span>productId</span>
              <span className="font-medium">Product Version:</span>
              <span>productVersion</span>
              <span className="font-medium">Replay Protection Count:</span>
              <span>replayProtectionCount</span>
              <span className="font-medium">Relay:</span>
              <span>relay</span>
              <span className="font-medium">Proxy:</span>
              <span>proxy</span>
              <span className="font-medium">Friend:</span>
              <span>friend</span>
              <span className="font-medium">Low Power:</span>
              <span>lowPower</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
