import { ChangeEvent, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import BluetoothManager from "../../../bluetooth/BluetoothManager";
import MeshConfigurationManager from "../../../bluetooth/MeshConfigurationManager";

interface Props {
  BluetoothManager: BluetoothManager;
  MeshConfigurationManager: MeshConfigurationManager;
}
const ElementSettings = ({ BluetoothManager, MeshConfigurationManager }: Props) => {
  const [elementEditedName, setElementEditedName] = useState<string | null>(null);
  const navigate = useNavigate();
  const params = useParams();

  const device = BluetoothManager.getDevice();
  if (!device || !params.elementNumber) {
    return <Navigate to="/provisioning" />;
  }

  const node = MeshConfigurationManager.getNodeById(device.id);
  if (!node) {
    return <Navigate to="/provisioning" />;
  }

  const element = node.elements[parseInt(params.elementNumber)];

  const onModelSelected = (modelNumber: number) => {
    navigate(`model/${modelNumber}`);
  };

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setElementEditedName(e.target.value);
  };

  const onSave = () => {
    if (!elementEditedName) return;
    MeshConfigurationManager.updateElementName(node.id, element.index, elementEditedName);
  };

  const arrow = "<-";
  return (
    <>
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <span>
            {arrow}
            <span className="link" onClick={() => navigate(-1)}>
              {node.name}
            </span>{" "}
            / {element.name ?? `Element ${params.elementNumber}`}
          </span>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
              <label>Name</label>
              <input
                type="text"
                className="border-solid border-2 p-2 border-border rounded-lg block"
                value={elementEditedName ?? element.name}
                onChange={handleNameChange}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label>Models</label>
              <div className="models-table border-solid border-2 border-border rounded-lg">
                <div className="bg-bg-light font-medium rounded-t-lg">
                  <span>Name</span>
                  <span>ID</span>
                </div>
                {element.models.map((m, i) => (
                  <ModelItem
                    name={m.modelID}
                    ID={m.modelID}
                    onModelSelected={onModelSelected}
                    modelIdx={i}
                    key={i}
                  />
                ))}
              </div>
            </div>

            <button className="primary ml-auto" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

interface ModelItemProps {
  modelIdx: number;
  name: string;
  ID: string;
  onModelSelected: (modelNumber: number) => void;
}
const ModelItem = ({ name, ID, modelIdx, onModelSelected }: ModelItemProps) => {
  return (
    <div className="flex flex-row items-center">
      <span className="flex-1">{name}</span>
      <span className="flex-1">{ID}</span>
      <button className="secondary " onClick={() => onModelSelected(modelIdx)}>
        Configure
      </button>
    </div>
  );
};

export default ElementSettings;
