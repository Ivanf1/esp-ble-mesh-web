import { Link, NavLink } from "react-router-dom";

const Sidemenu = () => {
  return (
    <aside className="w-[260px] min-h-screen overflow-x-auto fixed top-0 left-0">
      <div className="bg-primary min-h-screen">
        <ul className="space-y-2 pt-40 px-6">
          <NavLink
            to="dashboard"
            className={({ isActive }) =>
              isActive
                ? "flex items-center p-2 text-base font-normal text-white rounded-lg bg-secondary"
                : "flex items-center p-2 text-base font-normal text-white rounded-lg hover:bg-secondary"
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" height="20" width="20">
              <g>
                <rect
                  x="0.5"
                  y="0.5"
                  width="5"
                  height="5"
                  rx="1"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
                <rect
                  x="8.5"
                  y="0.5"
                  width="5"
                  height="5"
                  rx="1"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
                <rect
                  x="0.5"
                  y="8.5"
                  width="5"
                  height="5"
                  rx="1"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
                <rect
                  x="8.5"
                  y="8.5"
                  width="5"
                  height="5"
                  rx="1"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
              </g>
            </svg>
            <span className="flex-1 ml-3 whitespace-nowrap text-white">Dashboard</span>
          </NavLink>
          <NavLink
            to="connect"
            className={({ isActive }) =>
              isActive
                ? "flex items-center p-2 text-base font-normal text-white rounded-lg bg-secondary"
                : "flex items-center p-2 text-base font-normal text-white rounded-lg hover:bg-secondary"
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" height="20" width="20">
              <polyline
                points="3.25 9.5 10.75 4 6.75 0.5 6.75 13.5 10.75 10 3.25 4.5"
                fill="none"
                stroke="#ffffff"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></polyline>
            </svg>
            <span className="flex-1 ml-3 whitespace-nowrap text-white">Connect</span>
          </NavLink>
          <NavLink
            to="device"
            className={({ isActive }) =>
              isActive
                ? "flex items-center p-2 text-base font-normal text-white rounded-lg bg-secondary"
                : "flex items-center p-2 text-base font-normal text-white rounded-lg hover:bg-secondary"
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" height="20" width="20">
              <g>
                <rect
                  x="3"
                  y="3"
                  width="8"
                  height="8"
                  rx="1"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></rect>
                <line
                  x1="5"
                  y1="3"
                  x2="5"
                  y2="0.5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="9"
                  y1="3"
                  x2="9"
                  y2="0.5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="3"
                  y1="9"
                  x2="0.5"
                  y2="9"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="3"
                  y1="5"
                  x2="0.5"
                  y2="5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="9"
                  y1="11"
                  x2="9"
                  y2="13.5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="5"
                  y1="11"
                  x2="5"
                  y2="13.5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="11"
                  y1="5"
                  x2="13.5"
                  y2="5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="11"
                  y1="9"
                  x2="13.5"
                  y2="9"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="8.5"
                  y1="7.5"
                  x2="6.5"
                  y2="7.5"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
              </g>
            </svg>
            <span className="flex-1 ml-3 whitespace-nowrap text-white">Device</span>
          </NavLink>
          <NavLink
            to="mesh"
            className={({ isActive }) =>
              isActive
                ? "flex items-center p-2 text-base font-normal text-white rounded-lg bg-secondary"
                : "flex items-center p-2 text-base font-normal text-white rounded-lg hover:bg-secondary"
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" height="20" width="20">
              <path
                d="M5.23,2.25l.43-1.11A1,1,0,0,1,6.59.5h.82a1,1,0,0,1,.93.64l.43,1.11,1.46.84,1.18-.18a1,1,0,0,1,1,.49l.4.7a1,1,0,0,1-.08,1.13L12,6.16V7.84l.75.93a1,1,0,0,1,.08,1.13l-.4.7a1,1,0,0,1-1,.49l-1.18-.18-1.46.84-.43,1.11a1,1,0,0,1-.93.64H6.59a1,1,0,0,1-.93-.64l-.43-1.11-1.46-.84-1.18.18a1,1,0,0,1-1-.49l-.4-.7a1,1,0,0,1,.08-1.13L2,7.84V6.16l-.75-.93A1,1,0,0,1,1.17,4.1l.4-.7a1,1,0,0,1,1-.49l1.18.18ZM5,7A2,2,0,1,0,7,5,2,2,0,0,0,5,7Z"
                fill="none"
                stroke="#ffffff"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path>
            </svg>
            <span className="flex-1 ml-3 whitespace-nowrap text-white">Mesh</span>
          </NavLink>
          <NavLink
            to="graph"
            className={({ isActive }) =>
              isActive
                ? "flex items-center p-2 text-base font-normal text-white rounded-lg bg-secondary"
                : "flex items-center p-2 text-base font-normal text-white rounded-lg hover:bg-secondary"
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" height="20" width="20">
              <g>
                <circle
                  cx="2.5"
                  cy="7"
                  r="2"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></circle>
                <circle
                  cx="11.5"
                  cy="2.5"
                  r="2"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></circle>
                <circle
                  cx="11.5"
                  cy="11.5"
                  r="2"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></circle>
                <line
                  x1="3.71"
                  y1="5.41"
                  x2="9.56"
                  y2="2.98"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
                <line
                  x1="3.71"
                  y1="8.59"
                  x2="9.56"
                  y2="11.02"
                  fill="none"
                  stroke="#ffffff"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                ></line>
              </g>
            </svg>
            <span className="flex-1 ml-3 whitespace-nowrap text-white">Graph</span>
          </NavLink>
        </ul>
      </div>
    </aside>
  );
};

export default Sidemenu;
