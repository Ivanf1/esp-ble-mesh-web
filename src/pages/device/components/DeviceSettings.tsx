import { SubmitHandler, useForm } from "react-hook-form";
import { ElementModel, ProvisionedNode } from "../../../bluetooth/meshConfiguration.interface";
import MeshConfigurationManager from "../../../bluetooth/MeshConfigurationManager";
import { modelNameById } from "../../../bluetooth/ModelNameById";
import ConfigClient from "../../../bluetooth/models/ConfigClient";

interface IFormInput {
  netKey: string;
  appKey: string;
}
interface Props {
  device: ProvisionedNode;
  MeshConfigurationManager: MeshConfigurationManager;
  ConfigClient: ConfigClient;
  onElementSelected: (elementNumber: number) => void;
}
const DeviceSettings = ({
  onElementSelected,
  device,
  MeshConfigurationManager,
  ConfigClient,
}: Props) => {
  const {
    register,
    handleSubmit,
    getFieldState,
    formState: { isDirty },
    reset,
  } = useForm<IFormInput>();

  const onSubmit: SubmitHandler<IFormInput> = (data: IFormInput) => {
    const { isDirty } = getFieldState("appKey");
    if (isDirty) {
      if (data.appKey != "notassigned") {
        ConfigClient.addAppKey(device.unicastAddress);
        reset(undefined, { keepDirty: false, keepDirtyValues: false, keepValues: true });
      }
    }
  };

  return (
    <>
      <h5>Device Settings</h5>
      <div className="flex flex-col gap-10">
        <form className="flex flex-col gap-10" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-2">
            <label>Network Key</label>
            <select
              id="net-key"
              defaultValue={MeshConfigurationManager.getNetKey()}
              className="border-solid border-2 p-2 border-border rounded-lg block"
              {...register("netKey")}
            >
              <option value={MeshConfigurationManager.getNetKey()}>
                {MeshConfigurationManager.getNetKey()}
              </option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label>Application Key</label>
            <select
              id="net-key"
              defaultValue={
                device.appKeys.length > 0 ? MeshConfigurationManager.getAppKey() : "notassigned"
              }
              className="border-solid border-2 p-2 border-border rounded-lg block"
              {...register("appKey")}
            >
              <option value="notassigned">Not assigned</option>
              <option value={MeshConfigurationManager.getAppKey()}>
                {MeshConfigurationManager.getAppKey()}
              </option>
            </select>
          </div>
          <button className="primary ml-auto" type="submit" disabled={!isDirty}>
            Save
          </button>
        </form>

        <div className="flex flex-col gap-2">
          <label>Elements</label>
          <div className="elements-table grid min-w-full rounded-lg border-solid border-2 border-border text-left">
            <div className="bg-bg-light font-medium rounded-t-lg">
              <span>Name</span>
              <span>Unicast Address</span>
              <span>Models</span>
            </div>
            {device.elements.map((e, i) => {
              return (
                <ElementsTableElement
                  elementName={e.name ?? "Not assigned"}
                  unicastAddress={e.address}
                  models={e.models}
                  onConfigureElementClick={onElementSelected}
                  elementIdx={i}
                  key={i}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

interface ElementsTableElementProps {
  elementName: string;
  elementIdx: number;
  models: ElementModel[];
  unicastAddress: string;
  onConfigureElementClick: (elementNumber: number) => void;
}
const ElementsTableElement = ({
  elementName,
  elementIdx,
  models,
  unicastAddress,
  onConfigureElementClick,
}: ElementsTableElementProps) => {
  return (
    <div>
      <span>{elementName}</span>
      <span>{unicastAddress}</span>
      <div className="flex flex-col gap-2">
        {models.map((m, i) => (
          <span key={i}>{modelNameById.get(m.modelID) ?? m.modelID}</span>
        ))}
      </div>
      <button className="secondary self-start" onClick={() => onConfigureElementClick(elementIdx)}>
        Configure
      </button>
    </div>
  );
};

export default DeviceSettings;
