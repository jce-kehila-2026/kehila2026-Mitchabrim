import { useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminTopbar from "./AdminTopbar.jsx";

export default function AdminLayout({ title, subtitle, actions, children }) {
  // Persist collapsed state across navigation
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("admin-sidebar-collapsed") === "1";
  });

  useEffect(() => {
    localStorage.setItem("admin-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  return (
    <div className={`admin-shell ${collapsed ? "is-collapsed" : ""}`}>
      <AdminSidebar collapsed={collapsed} onToggle={toggle} />
      <div className="admin-main">
        <AdminTopbar />
        <div className="admin-content">
          {(title || actions) && (
            <div className="admin-page-header">
              <div>
                {title && <h1>{title}</h1>}
                {subtitle && <p>{subtitle}</p>}
              </div>
              {actions && <div className="page-actions">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
