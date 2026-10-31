// Roles: three manager roles, and everyone else is a Sensei. Managers can add
// and remove senseis on the Dashboard. Shared by the browser and the server.
export type Role = { role_id: number; role_name: string };

export const SENSEI_ROLE: Role = { role_id: 0, role_name: "Sensei" };
export const MANAGER_ROLES: Role[] = [
  { role_id: 1, role_name: "Center Director" },
  { role_id: 2, role_name: "Assistant Center Director" },
  { role_id: 3, role_name: "Lead Sensei" },
];
export const ROLES: Role[] = [SENSEI_ROLE, ...MANAGER_ROLES];

export function isManager(role?: Role | null): boolean {
  return !!role && MANAGER_ROLES.some((r) => r.role_id === role.role_id);
}
