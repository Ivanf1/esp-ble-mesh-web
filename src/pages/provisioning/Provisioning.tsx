import { useState } from "react";
import { ReactComponent as ConnectSVG } from "../../assets/img/connect_ill.svg";
import ProgressBar from "../../components/ProgressBar";

const Provisioning = () => {
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const onConnectionClick = () => {};

  const onProvisionClick = () => {
    setIsProvisioning(true);
  };

  const onAbortClick = () => {
    setIsProvisioning(false);
  };

  return (
    <>
      <h2 className="mb-16">Provisioning</h2>
      {/* <div className="mx-auto">
        <div className="py-10 rounded-lg border-solid border-2 border-border flex flex-col items-center gap-10">
          <ConnectSVG />
          <h4>Connect to a device</h4>
          <button className="primary" onClick={onConnectionClick}>
            Connect
          </button>
        </div>
      </div> */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div>
          <h5 className="mb-3">Connected Device</h5>
          <div className="p-5 rounded-t-lg border-solid border-2 border-border">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
              <span className="font-medium">Name:</span>
              <span>ESP-BLE-MESH</span>
              <span className="font-medium">Id:</span>
              <span>kgskihjgihjworitg</span>
              <span className="font-medium">Some:</span>
              <span>kgskihjgihjworitg</span>
            </div>
          </div>
          <div className="p-5 rounded-b-lg border-solid border-x-2 border-b-2 border-border flex flex-col">
            {isProvisioning ? (
              <>
                <span>Device is being provisioned...</span>
                <ProgressBar completed={44} total={100} showLabel={true} />
                <button className="cancel ml-auto mt-5" onClick={onAbortClick}>
                  Abort
                </button>
              </>
            ) : (
              <button className="primary ml-auto" onClick={onProvisionClick}>
                Provision
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Provisioning;
