import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Calendar } from "../components/ui/calendar";
import {
    Users,
    Clock,
    CalendarOff,
    FileText,
    ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { leaveTypeConfig, statusConfig, categoryConfig } from "../config/leaveConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function Dashboard() {
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [balance, setBalance] = useState(null);
    const [recentLeaves, setRecentLeaves] = useState([]);
    const [calendarLeaves, setCalendarLeaves] = useState([]);
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    useEffect(() => {
        if (!currentUser) return;
        const load = async () => {
            try {
                const requests = [
                    axios.get(`${API}/leaves/balance/${currentUser.id}`),
                    axios.get(`${API}/leaves/employee/${currentUser.id}`)
                ];
                
                if (currentUser.role !== "employee") {
                    requests.push(axios.get(`${API}/dashboard/stats`));
                }
                
                const responses = await Promise.all(requests);
                setBalance(responses[0].data);
                setRecentLeaves(responses[1].data.slice(0, 5));
                
                if (currentUser.role !== "employee") {
                    setStats(responses[2].data);
                }
            } catch (err) {
                console.error("Dashboard load error", err);
            }
        };
        load();
    }, [currentUser]);

    const [holidays, setHolidays] = useState([]);

    useEffect(() => {
        const loadCalendar = async () => {
            try {
                const [lRes, hRes] = await Promise.all([
                    axios.get(`${API}/leaves/calendar`, {
                        params: { month: calendarMonth.getMonth() + 1, year: calendarMonth.getFullYear() },
                    }),
                    axios.get(`${API}/holidays`)
                ]);
                setCalendarLeaves(lRes.data);
                
                const monthStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}`;
                setHolidays(hRes.data.filter(h => h.date.startsWith(monthStr)));
            } catch (err) {
                console.error(err);
            }
        };
        loadCalendar();
    }, [calendarMonth]);

    if (!currentUser) return null;

    const leaveDates = calendarLeaves.reduce((acc, leave) => {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const current = new Date(start);
        while (current <= end) {
            const key = current.toISOString().split("T")[0];
            if (!acc[key]) acc[key] = [];
            acc[key].push(leave);
            current.setDate(current.getDate() + 1);
        }
        return acc;
    }, {});

    const modifiers = {};
    const modifiersClassNames = {};

    Object.keys(leaveDates).forEach((d) => {
        const leave = leaveDates[d][0];
        const category = leave.category || "leave";
        if (!modifiers[category]) modifiers[category] = [];
        modifiers[category].push(new Date(d + "T00:00:00"));
    });
    
    modifiers["holiday"] = holidays.map(h => new Date(h.date + "T00:00:00"));

    Object.keys(categoryConfig).forEach((cat) => {
        modifiersClassNames[cat] = `${categoryConfig[cat].bg} ${categoryConfig[cat].text} rounded-full font-bold`;
    });
    modifiersClassNames["leave"] = `${leaveTypeConfig.leave.bg} ${leaveTypeConfig.leave.text} rounded-full font-bold`;
    modifiersClassNames["holiday"] = "bg-fuchsia-100 dark:bg-fuchsia-500/20 text-fuchsia-700 dark:text-fuchsia-400 rounded-full font-bold border border-fuchsia-200 dark:border-fuchsia-500/30";

    const totalAlloc = balance ? (balance.leave || 18) : 18;
    const totalUsed = balance ? (balance.leave_used || 0) : 0;
    const totalAvailable = Math.max(0, totalAlloc - totalUsed);
    const totalLop = balance ? (balance.lop_used || 0) : 0;

    return (
        <div className="animate-fade-in" data-testid="dashboard">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Welcome back, {currentUser.name.split(" ")[0]}
                </h1>
                <p className="text-slate-500 mt-1 text-sm">Here's your leave overview for {new Date().getFullYear()}</p>
            </div>

            {/* Stats Row (Admin/Manager) */}
            {(currentUser.role === "admin" || currentUser.role === "manager") && stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Total Employees", value: stats.total_employees, icon: Users, color: "text-slate-600 dark:text-slate-400" },
                        { label: "Pending Requests", value: stats.pending_requests, icon: Clock, color: "text-amber-600" },
                        { label: "On Leave Today", value: stats.on_leave_today, icon: CalendarOff, color: "text-sky-600" },
                        { label: "Total Requests", value: stats.total_requests, icon: FileText, color: "text-indigo-600" },
                    ].map((stat) => (
                        <Card key={stat.label} className="app-card" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stat.value}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Leave Balance Overview */}
                <div className="col-span-1 md:col-span-8 flex flex-col gap-4">
                    {balance && (
                        <Card className="app-card h-full flex flex-col justify-center" data-testid="balance-total">
                            <CardContent className="p-8 h-full flex flex-col sm:flex-row items-center sm:items-stretch gap-8">
                                <div className="flex-1 w-full text-center sm:text-left flex flex-col justify-center">
                                    <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                                        <div className={`p-3 rounded-lg ${leaveTypeConfig.leave.bg}`}>
                                            <leaveTypeConfig.leave.icon className={`w-6 h-6 ${leaveTypeConfig.leave.iconColor}`} />
                                        </div>
                                        <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">Annual Leaves</p>
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Available Balance</p>
                                    <div className="flex items-baseline justify-center sm:justify-start gap-2">
                                        <p className="text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{totalAvailable}</p>
                                        <p className="text-xl font-medium text-slate-400">/ {totalAlloc} days</p>
                                    </div>
                                </div>
                                <div className="flex-1 w-full flex flex-col justify-center items-center sm:items-end border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-6 sm:pt-0 sm:pl-8">
                                    <div className="w-full max-w-xs">
                                        <div className="flex justify-between text-sm mb-2 font-medium">
                                            <span className="text-slate-500">Usage</span>
                                            <span className="text-slate-700 dark:text-slate-300">{totalUsed} days used</span>
                                        </div>
                                        <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden w-full">
                                            <div
                                                className={`h-full ${leaveTypeConfig.leave.barColor} rounded-full transition-all duration-500`}
                                                style={{ width: `${(totalUsed / totalAlloc) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => navigate("/apply-leave")}
                                        className="mt-6 w-full max-w-xs flex justify-center items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-all duration-200 active:scale-95 shadow-sm"
                                        data-testid="apply-leave-cta"
                                    >
                                        Apply Leave <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                    {balance && (
                        <Card className="app-card border-amber-200 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-500/10" data-testid="lop-total">
                            <CardContent className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-500/20">
                                        <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">Loss of Pay (LOP)</p>
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Unpaid leaves taken</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {totalLop > 0 ? (
                                        <p className="text-3xl font-bold tracking-tight text-amber-700 dark:text-amber-400">{totalLop} <span className="text-lg font-medium text-amber-600/60 dark:text-amber-500/60">days</span></p>
                                    ) : (
                                        <p className="text-2xl font-semibold tracking-tight text-slate-400 dark:text-slate-500">N/A</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Calendar Widget */}
                <div className="col-span-1 md:col-span-4 row-span-2">
                    <Card className="app-card h-full" data-testid="calendar-widget">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Team Calendar</CardTitle>
                        </CardHeader>
                        <CardContent className="px-2">
                            <Calendar
                                mode="single"
                                month={calendarMonth}
                                onMonthChange={setCalendarMonth}
                                modifiers={modifiers}
                                modifiersClassNames={modifiersClassNames}
                                className="w-full"
                            />
                            {calendarLeaves.length > 0 && (
                                <div className="px-4 pb-4 mt-2">
                                    <p className="text-xs font-medium text-slate-500 mb-2">On leave this month</p>
                                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                        {calendarLeaves.slice(0, 5).map((l) => {
                                            const category = l.category ? categoryConfig[l.category] : null;
                                            const dotColor = category ? category.dot : leaveTypeConfig.leave.barColor;
                                            return (
                                                <div key={l.id} className="flex items-center gap-2 text-xs">
                                                    <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                    <span className="text-slate-700 dark:text-slate-300 font-medium">{l.employee_name}</span>
                                                    <span className="text-slate-400">
                                                        {l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Requests */}
                <div className="col-span-1 md:col-span-8">
                    <Card className="app-card" data-testid="recent-leaves">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent Leave Requests</CardTitle>
                                <button
                                    onClick={() => navigate("/my-leaves")}
                                    className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-200 transition-colors"
                                    data-testid="view-all-leaves"
                                >
                                    View all
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {recentLeaves.length === 0 ? (
                                <p className="text-sm text-slate-400 py-6 text-center">No leave requests yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {recentLeaves.map((leave) => {
                                        const config = leaveTypeConfig.leave;
                                        const category = leave.category ? categoryConfig[leave.category] : null;
                                        return (
                                            <div
                                                key={leave.id}
                                                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50/50 hover:bg-slate-50 dark:bg-slate-800/50 transition-colors"
                                                data-testid={`leave-row-${leave.id}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-lg ${config.bg}`}>
                                                        {config.icon && <config.icon className={`w-3.5 h-3.5 ${config.iconColor}`} />}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{config.label} Leave</p>
                                                            {category && (
                                                                <Badge className={`text-[9px] border px-1 ${category.badge}`}>
                                                                    {category.label}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400">{leave.start_date} to {leave.end_date}</p>
                                                    </div>
                                                </div>
                                                <Badge className={`text-[10px] border ${statusConfig[leave.status]}`}>
                                                    {leave.status}
                                                </Badge>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}