import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { FileText } from "lucide-react";
import { leaveTypeConfig, statusConfig, categoryConfig } from "../config/leaveConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function MyLeaves() {
    const { currentUser } = useUser();
    const [leaves, setLeaves] = useState([]);
    const [filter, setFilter] = useState("all");

    useEffect(() => {
        if (!currentUser) return;
        const init = async () => {
            try {
                const res = await axios.get(`${API}/leaves/employee/${currentUser.id}`);
                setLeaves(res.data);
                axios.post(`${API}/leaves/mark-read`).catch(console.error);
            } catch (err) {
                console.error(err);
            }
        };
        init();
    }, [currentUser]);

    const filtered = filter === "all" ? leaves : leaves.filter((l) => l.status === filter);

    if (!currentUser) return null;

    const renderApprovalBadge = (label, status, name) => {
        if (!status) return null;
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

    return (
        <div className="animate-fade-in" data-testid="my-leaves-page">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    My Leaves
                </h1>
                <p className="text-slate-500 mt-1 text-sm">Track your leave request history</p>
            </div>

            <Tabs value={filter} onValueChange={setFilter} className="mb-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
                    <TabsTrigger value="pending" data-testid="filter-pending">Pending</TabsTrigger>
                    <TabsTrigger value="approved" data-testid="filter-approved">Approved</TabsTrigger>
                    <TabsTrigger value="rejected" data-testid="filter-rejected">Rejected</TabsTrigger>
                </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
                <Card className="app-card">
                    <CardContent className="py-12 text-center">
                        <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No leave requests found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((leave) => {
                        const config = leaveTypeConfig.leave;
                        const category = leave.category ? categoryConfig[leave.category] : null;
                        return (
                            <Card key={leave.id} className="app-card" data-testid={`my-leave-${leave.id}`}>
                                <CardContent className="p-5">
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg ${config.bg} mt-0.5`}>
                                                {config.icon && <config.icon className={`w-4 h-4 ${config.iconColor}`} />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{config.label} Request</p>
                                                    {leave.status !== "pending" && !leave.is_read && (
                                                        <Badge className="bg-rose-500 hover:bg-rose-600 text-white border-transparent px-1.5 py-0 text-[9px] shadow-sm animate-pulse">
                                                            NEW
                                                        </Badge>
                                                    )}
                                                    {category && (
                                                        <Badge className={`text-[9px] border px-1 ${category.badge}`}>
                                                            {category.label}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {leave.start_date} to {leave.end_date}
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
                                        <Badge className={`text-[10px] border ${statusConfig[leave.status] || "bg-slate-50 dark:bg-slate-800/50 text-slate-500"}`}>
                                            Overall: {leave.status}
                                        </Badge>
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