import AppSidebar from "./AppSidebar";

function AppShell({ user, onLogout, children }) {
  return (
    <div className="main-layout">
      <AppSidebar user={user} onLogout={onLogout} />
      <main className="content">
        {children}
      </main>
    </div>
  );
}

export default AppShell;
