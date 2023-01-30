import { ChangeEvent, useState } from "react";
import MeshConfigurationManager from "../../bluetooth/MeshConfigurationManager";

interface Group {
  name: string;
  address: string;
  subscribers: number;
  publishers: number;
}
interface Props {
  MeshConfigurationManager: MeshConfigurationManager;
}
const Mesh = ({ MeshConfigurationManager }: Props) => {
  const [isAddingGroup, setIsAddingGroup] = useState<boolean>(false);
  const [groups, setGroups] = useState(MeshConfigurationManager.getGroups());

  const handleAddGroup = (group: NewGroup) => {
    MeshConfigurationManager.addGroup(group.address, group.name);
    setIsAddingGroup(false);
    setGroups(MeshConfigurationManager.getGroups());
  };

  const handleDeleteGroup = (address: string) => {
    MeshConfigurationManager.deleteGroup(address);
    setGroups(MeshConfigurationManager.getGroups());
  };

  const handleEditGroup = (group: EditedGroup) => {
    MeshConfigurationManager.updateGroupName(group.address, group.name);
  };

  const onCreateGroupClick = () => {
    if (isAddingGroup) return;
    setIsAddingGroup(true);
  };

  return (
    <>
      <h2 className="mb-16">Mesh</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <h5>Mesh settings</h5>
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
              <label>Network Key</label>
              <select
                id="net-key"
                defaultValue={1}
                className="border-solid border-2 p-2 border-border rounded-lg block"
              >
                <option value="abcdefghi">{MeshConfigurationManager.getNetKey()}</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label>Application Key</label>
              <select
                id="net-key"
                defaultValue={1}
                className="border-solid border-2 p-2 border-border rounded-lg block"
              >
                <option value="abcdefghi">{MeshConfigurationManager.getAppKey()}</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label>Groups</label>
              <div className="groups-table grid min-w-full rounded-lg border-solid border-2 border-border text-left">
                <div className="bg-bg-light font-medium rounded-t-lg">
                  <span>Name</span>
                  <span className="mx-auto">Address</span>
                  <span className="mx-auto">Subscribers</span>
                  <span className="mx-auto">Publishers</span>
                </div>

                {groups.map((g, i) => {
                  return (
                    <GroupsTableElement
                      address={g.address}
                      name={g.name}
                      publishers={MeshConfigurationManager.getPublishersForGroup(g.address).length}
                      subscribers={
                        MeshConfigurationManager.getSubscribersForGroup(g.address).length
                      }
                      onDeleteGroup={handleDeleteGroup}
                      onSaveEditGroup={handleEditGroup}
                      key={i}
                    />
                  );
                })}

                {isAddingGroup && <NewGroupElement onSave={handleAddGroup} />}
              </div>
              <button className="primary ml-auto" onClick={onCreateGroupClick}>
                New Group
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

type EditedGroup = Pick<Group, "name" | "address">;
interface GroupsTableElementProps {
  name: string;
  address: string;
  subscribers: number;
  publishers: number;
  onSaveEditGroup: (editedGroup: EditedGroup) => void;
  onDeleteGroup: (address: string) => void;
}
const GroupsTableElement = ({
  name,
  address,
  subscribers,
  publishers,
  onSaveEditGroup,
  onDeleteGroup,
}: GroupsTableElementProps) => {
  const [editing, setEditing] = useState<boolean>(false);
  const [editedName, setEditedName] = useState(name);

  const saveModifications = () => {
    setEditing(false);
    onSaveEditGroup({ address: address, name: editedName });
  };

  const handleEditName = (e: ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleDelete = () => {};

  return (
    <div>
      <input
        className=""
        value={editedName}
        onChange={handleEditName}
        disabled={!editing}
        type="text"
      />
      <span className="mx-auto">{address}</span>
      <span className="mx-auto">{subscribers}</span>
      <span className="mx-auto">{publishers}</span>
      <div className="flex items-center justify-center gap-4">
        {editing ? (
          <button className="secondary" onClick={saveModifications}>
            Save
          </button>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="table-action"
              onClick={() => setEditing(true)}
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="table-action"
              onClick={() => onDeleteGroup(address)}
            >
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </>
        )}
      </div>
    </div>
  );
};

type NewGroup = Pick<Group, "name" | "address">;
interface NewGroupElementProps {
  onSave: (group: NewGroup) => void;
}
const NewGroupElement = ({ onSave }: NewGroupElementProps) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleAddressChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAddress(e.target.value);
  };

  return (
    <div>
      <input className="" value={name} onChange={handleNameChange} type="text" />
      <input className="w-[100%]" value={address} onChange={handleAddressChange} type="text" />
      <span className="mx-auto">0</span>
      <span className="mx-auto">0</span>
      <div className="flex items-center justify-center gap-4">
        <button className="secondary" onClick={() => onSave({ name, address })}>
          Save
        </button>
      </div>
    </div>
  );
};

export default Mesh;
