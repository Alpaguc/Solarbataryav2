import AppSidebar from "./AppSidebar";

function AppShell({ user, onLogout, children }) {
  return (
    <div className="ana-arkaplan">
      <div className="main-layout">
        <AppSidebar user={user} onLogout={onLogout} />
        <main className="content-area">
          <div className="app-modul-kapsayici">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
