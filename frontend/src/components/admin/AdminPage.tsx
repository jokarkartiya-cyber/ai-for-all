import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/common";
import { cn } from "@/utils/cn";
import api from "@/services/api";
import toast from "react-hot-toast";
import { Shield, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  emailVerified: boolean;
  created_at: string;
}

export function AdminPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadUsers();
  }, [page, isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { page, limit: 20 } });
      setUsers(data.data);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role });
      toast.success("Role updated");
      loadUsers();
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Delete user "${username}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("User deleted");
      loadUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="btn-ghost p-1.5">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Shield className="h-6 w-6 text-primary-500" />
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center">
            <span className="text-sm font-medium">Users ({total})</span>
            <Button size="sm" onClick={loadUsers} loading={loading}>
              Refresh
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800 text-surface-500 text-xs uppercase">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Verified</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-surface-100 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50">
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-surface-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", u.emailVerified ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300")}>
                        {u.emailVerified ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input h-7 text-xs w-28"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="moderator">Moderator</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-surface-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="btn-ghost p-1.5 text-red-500 hover:text-red-600"
                        title="Delete user"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
              <span className="text-xs text-surface-500">Page {page} of {Math.ceil(total / 20)}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <Button size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 20)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
