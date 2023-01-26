import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { WithContext as ReactTags } from "react-tag-input";
interface Tag {
  id: string;
  text: string;
}

interface Props {}
const ModelSettings = ({}: Props) => {
  const navigate = useNavigate();
  const params = useParams();

  const arrow = "<-";

  const [tags, setTags] = useState([
    { id: "0x000C", text: "0x000C" },
    { id: "0x000D", text: "0x000D" },
    { id: "0x0003", text: "0x0003" },
    { id: "0x000F", text: "0x000F" },
  ]);

  const suggestions = [
    { id: "0x000C", text: "0x000C" },
    { id: "0x000D", text: "0x000D" },
    { id: "0x0003", text: "0x0003" },
    { id: "0x000F", text: "0x000F" },
  ];

  const handleDelete = (i: number) => {
    setTags(tags.filter((_, index) => index !== i));
  };

  const handleAddition = (tag: Tag) => {
    const lowerCaseQuery = tag.text.toLowerCase();

    if (suggestions.find((t) => t.text.toLowerCase() === lowerCaseQuery)) {
      setTags([...tags, tag]);
    }
  };

  const suggestionFilter = (textInputValue: string, possibleSuggestionsArray: Tag[]) => {
    const lowerCaseQuery = textInputValue.toLowerCase();

    return possibleSuggestionsArray.filter((suggestion) => {
      return suggestion.text.toLowerCase().includes(lowerCaseQuery);
    });
  };

  return (
    <>
      <h2 className="mb-16">Settings</h2>
      <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-10">
        <div className="flex flex-col gap-10">
          <span>
            {arrow}
            <span className="link" onClick={() => navigate(-2)}>
              DeviceName
            </span>{" "}
            /{" "}
            <span className="link" onClick={() => navigate(-1)}>
              Element {" " + params.elementNumber}
            </span>{" "}
            / Model {" " + params.modelNumber}
          </span>

          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
              <label>Application Key</label>
              <select
                id="net-key"
                className="border-solid border-2 p-2 border-border rounded-lg block"
                defaultValue={0}
              >
                <option>Not assigned</option>
                <option value="abcdefghi">abcdefghi</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex">
                <label>Publication</label>
                <Link to={"/mesh"} className="ml-auto text-sm mt-0 link">
                  Manage Groups
                </Link>
              </div>
              <select
                id="net-key"
                className="border-solid border-2 p-2 border-border rounded-lg block"
                defaultValue={0}
              >
                <option>Not assigned</option>
                <option value="abcdefghi">abcdefghi</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex">
                <label>Subscriptions</label>
                <Link to={"/mesh"} className="ml-auto text-sm mt-0 link">
                  Manage Groups
                </Link>
              </div>
              <div className="border-solid border-2 border-border rounded-lg">
                <ReactTags
                  tags={tags}
                  suggestions={suggestions}
                  handleDelete={handleDelete}
                  handleAddition={handleAddition}
                  inline={false}
                  allowDragDrop={false}
                  handleFilterSuggestions={suggestionFilter}
                  allowUnique={true}
                  maxLength={6}
                  minQueryLength={1}
                  placeholder="Add subscription"
                  autofocus={false}
                />
              </div>
            </div>

            <button className="primary ml-auto">Save</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModelSettings;
