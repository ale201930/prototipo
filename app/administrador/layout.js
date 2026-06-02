import React from "react";
import RoleGuard from "../lib/RoleGuard";

export default function AdminLayout({ children }) {
  return (
    <RoleGuard allowedRole="administrador">
      <div className="admin-container">

        <main className="admin-content">
          {children}
        </main>

      </div>
    </RoleGuard>
  );
}