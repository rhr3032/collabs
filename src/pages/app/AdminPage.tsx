import { useEffect, useState } from "react";
import { Shield, Users, CreditCard, Loader2, CheckCircle, XCircle, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";

interface UserRow {
  id: string;
  email: string;
  created_at: string;
}

interface SubRow {
  user_id: string;
  product_id: string | null;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

const TIERS: Record<string, string> = {
  prod_U0mdKARhdAgcvt: "Pro",
  prod_U0mdD8AZgmGUYu: "Agency",
};

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const fetchData = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, created_at")
      .order("created_at", { ascending: false });

    if (profiles) {
      setUsers(profiles.map((p) => ({ id: p.user_id, email: p.email || "N/A", created_at: p.created_at })));
    }

    const { data: subData } = await supabase
      .from("subscriptions" as any)
      .select("user_id, product_id, status, current_period_end, stripe_customer_id") as any;

    if (subData) {
      setSubs(subData as SubRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchData();
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/app/inbox" replace />;
  }

  const getSubForUser = (userId: string) => subs.find((s) => s.user_id === userId);
  const paidCount = subs.filter((s) => s.status === "active").length;
  const totalCount = users.length;

  const filteredUsers = users.filter((u) => {
    const matchesSearch = !search || u.email.toLowerCase().includes(search.toLowerCase());
    if (filterStatus === "all") return matchesSearch;
    const sub = getSubForUser(u.id);
    if (filterStatus === "paid") return matchesSearch && sub?.status === "active";
    if (filterStatus === "unpaid") return matchesSearch && (!sub || sub.status !== "active");
    return matchesSearch;
  });

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    const { error } = await (supabase.from("subscriptions" as any) as any)
      .upsert({ user_id: userId, status: newStatus }, { onConflict: "user_id" });

    if (error) {
      toast.error("Failed to update subscription status");
      return;
    }
    toast.success("Subscription status updated");
    fetchData();
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage users and subscriptions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold font-display">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold font-display">{paidCount}</p>
                <p className="text-xs text-muted-foreground">Paid Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-2xl font-bold font-display">{totalCount - paidCount}</p>
                <p className="text-xs text-muted-foreground">Unpaid Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-lg">All Users</CardTitle>
              <CardDescription>View and manage user subscription statuses</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Email</span>
                <span>Plan</span>
                <span>Status</span>
                <span>Expires</span>
                <span>Actions</span>
              </div>
              {filteredUsers.map((u) => {
                const sub = getSubForUser(u.id);
                const tierName = sub?.product_id ? TIERS[sub.product_id] || "Unknown" : "Free";
                const isActive = sub?.status === "active";
                return (
                  <div key={u.id} className="grid grid-cols-5 gap-4 px-3 py-3 rounded-lg border border-border items-center">
                    <span className="text-sm truncate" title={u.email}>{u.email}</span>
                    <Badge variant={isActive ? "default" : "outline"} className="w-fit">
                      {tierName}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {isActive ? (
                        <CheckCircle className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs capitalize">{sub?.status || "none"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {sub?.current_period_end
                        ? new Date(sub.current_period_end).toLocaleDateString()
                        : "—"}
                    </span>
                    <Select
                      value={sub?.status || "inactive"}
                      onValueChange={(val) => handleUpdateStatus(u.id, val)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="canceled">Canceled</SelectItem>
                        <SelectItem value="trialing">Trialing</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
              {filteredUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
