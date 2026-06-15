"use client";
import RoleGuard from "../lib/RoleGuard";
import { useAutoInasistencias } from "../lib/useAutoInasistencias";

function RRHHContent({ children }) {
  // Procesa inasistencias automáticamente al abrir cualquier página de RRHH
  useAutoInasistencias();
  return <>{children}</>;
}

export default function RRHHLayout({ children }) {
  return (
    <RoleGuard allowedRole="recursos humanos">
      <RRHHContent>{children}</RRHHContent>
    </RoleGuard>
  );
}