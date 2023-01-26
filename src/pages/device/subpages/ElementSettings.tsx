import { useNavigate, useParams } from "react-router-dom";

interface Props {}
const ElementSettings = ({}: Props) => {
  const navigate = useNavigate();
  const params = useParams();

  const onModelSelected = (modelNumber: number) => {
    navigate(`model/${modelNumber}`);
  };

  const models = [
    {
      name: "Configuration Server",
      ID: "0x0000",
    },
    {
      name: "Generic OnOff Server",
      ID: "0x0001",
    },
  ];

  const arrow = "<-";
  return (
    <>
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <span>
            {arrow}
            <span className="link" onClick={() => navigate(-1)}>
              DeviceName
            </span>{" "}
            / Element {" " + params.elementNumber}
          </span>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
              <label>Name</label>
              <input
                type="text"
                className="border-solid border-2 p-2 border-border rounded-lg block"
                placeholder="No Name"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label>Models</label>
              <div className="models-table border-solid border-2 border-border rounded-lg">
                <div className="bg-bg-light font-medium rounded-t-lg">
                  <span>Name</span>
                  <span>ID</span>
                </div>
                {models.map((m, i) => (
                  <ModelItem
                    name={m.name}
                    ID={m.ID}
                    onModelSelected={onModelSelected}
                    modelIdx={i}
                    key={i}
                  />
                ))}
              </div>
            </div>

            <button className="primary ml-auto">Save</button>
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
