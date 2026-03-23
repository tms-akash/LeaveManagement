import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Check, X, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { leaveTypeConfig, statusConfig, categoryConfig } from "../config/leaveConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function TeamLeaves() {
    const { currentUser } = useUser();
    const [leaves, setLeaves] = useState([]);
    const [filter, setFilter] = useState("pending");

    const loadLeaves = async () => {
        try {
            const res = await axios.get(`${API}/leaves`);
            setLeaves(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!currentUser) return;
        const init = async () => {
            await loadLeaves();
            axios.post(`${API}/leaves/team/mark-read`).catch(console.error);
        };
        init();
    }, [currentUser]);

    const handleAction = async (leaveId, status) => {
        try {
            await axios.put(`${API}/leaves/${leaveId}/status`, {
                status,
                reviewer_id: currentUser.id,
            });
            toast.success(status === "approved" ? "Permission granted! We've let them know they can start packing." : "The hammer has fallen. We've broken the news that they're staying put.");
            loadLeaves();
        } catch (err) {
            toast.error("The gears are stuck! Failed to update that leave status.");
        }
    };

    const filtered = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);

    if (!currentUser) return null;

    const renderApprovalBadge = (label, status, name) => {
        if (!status) return null; // In case of older records
        let color = "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700";
        if (status === "approved" || status === "not_required") color = "bg-emerald-50 text-emerald-600 border-emerald-200";
        if (status === "rejected") color = "bg-rose-50 text-rose-600 border-rose-200";

        return (
            <div className="flex flex-col gap-0.5 mt-2">
                <div className="flex items-center gap-1">
                    <Badge className={`text-[9px] border px-1.5 py-0 shadow-sm ${color}`}>
                        {label}: {status === "not_required" ? "N/A" : status.toUpperCase()}
                    </Badge>
                </div>
                {name && <p className="text-[10px] text-slate-400">by {name}</p>}
            </div>
        );
    };

    const canApprove = (leave) => {
        if (leave.status === "rejected") return false;
        if (currentUser.role === "manager" && leave.manager_approval === "pending") return true;
        if (currentUser.role === "admin" && leave.admin_approval === "pending") return true;
        return false;
    };

    return (
        <div className="animate-fade-in" data-testid="team-leaves-page">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Team Leaves
                </h1>
                <p className="text-slate-500 mt-1 text-sm">Manage and approve leave requests</p>
            </div>

            <Tabs value={filter} onValueChange={setFilter} className="mb-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger value="pending" data-testid="team-filter-pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved" data-testid="team-filter-approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected" data-testid="team-filter-rejected">Rejected</TabsTrigger>
                    <TabsTrigger value="all" data-testid="team-filter-all">All</TabsTrigger>
                </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
                <Card className="app-card">
                    <CardContent className="py-12 text-center">
                        <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No {filter} leave requests</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((leave) => {
                        const config = leaveTypeConfig.leave;
                        const category = leave.category ? categoryConfig[leave.category] : null;
                        return (
                            <Card key={leave.id} className="app-card" data-testid={`team-leave-${leave.id}`}>
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className={`p-2 rounded-lg ${config.bg} mt-0.5`}>
                                                {config.icon && <config.icon className={`w-4 h-4 ${config.iconColor}`} />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{leave.employee_name}</p>
                                                    {((currentUser.role === "manager" && !leave.manager_read) || (currentUser.role === "admin" && !leave.admin_read)) && (
                                                        <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-transparent px-1.5 py-0 text-[9px] shadow-sm animate-pulse">
                                                            NEW
                                                        </Badge>
                                                    )}
                                                    {category && (
                                                        <Badge className={`text-[9px] border px-1 ${category.badge}`}>
                                                            {category.label}
                                                        </Badge>
                                                    )}
                                                    <Badge className={`text-[10px] border ${statusConfig[leave.status] || "bg-slate-50 dark:bg-slate-800/50 text-slate-500"}`}>
                                                        Overall: {leave.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-slate-500">
                                                    {config.label} Request &middot; {leave.start_date} to {leave.end_date}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">{leave.reason}</p>
                                                {leave.is_lop && leave.lop_days > 0 && (
                                                    <Badge className="mt-1 text-[10px] border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                                                        LOP: {leave.lop_days} day(s)
                                                    </Badge>
                                                )}
                                                <div className="flex items-start gap-4 mt-2 mb-1">
                                                    {renderApprovalBadge("Manager", leave.manager_approval, leave.manager_reviewer_name)}
                                                    {renderApprovalBadge("Admin", leave.admin_approval, leave.admin_reviewer_name)}
                                                </div>
                                            </div>
                                        </div>
                                        {canApprove(leave) && (
                                            <div className="flex w-full sm:w-auto gap-2 shrink-0 border-t sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0 border-slate-100 dark:border-slate-800">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAction(leave.id, "approved")}
                                                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs px-3 h-8 transition-all duration-200 active:scale-95"
                                                    data-testid={`approve-${leave.id}`}
                                                >
                                                    <Check className="w-3.5 h-3.5 mr-1" /> Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleAction(leave.id, "rejected")}
                                                    className="flex-1 sm:flex-none border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg text-xs px-3 h-8 transition-all duration-200 active:scale-95"
                                                    data-testid={`reject-${leave.id}`}
                                                >
                                                    <X className="w-3.5 h-3.5 mr-1" /> Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}