import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

// Pages set the topbar title/actions via this context (see usePageHeader).
import { createContext, useContext, useEffect } from "react";

const PageHeaderContext = createContext(() => {});

export const usePageHeader = (title, actions = null) => {
  const setHeader = useContext(PageHeaderContext);
  useEffect(() => {
    setHeader({ title, actions });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, actions, setHeader]);
};

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [header, setHeader] = useState({ title: "Hisab-Kitab", actions: null });

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="app-main">
        <Topbar
          title={header.title}
          actions={header.actions}
          onMenuClick={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="app-content">
          <PageHeaderContext.Provider value={setHeader}>
            <Outlet />
          </PageHeaderContext.Provider>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
