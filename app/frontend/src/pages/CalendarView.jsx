import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUser } from "../context/UserContext";
import { leaveTypeConfig, categoryConfig } from "../config/leaveConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export default function CalendarView() {
    const { currentUser } = useUser();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [leaves, setLeaves] = useState([]);
    const [holidays, setHolidays] = useState([]);

    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [lRes, hRes] = await Promise.all([
                    axios.get(`${API}/leaves/calendar`, { params: { month: month + 1, year } }),
                    axios.get(`${API}/holidays`)
                ]);
                setLeaves(lRes.data);
                
                // filter holidays for current month
                const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
                setHolidays(hRes.data.filter(h => h.date.startsWith(monthStr)));
            } catch (err) {
                console.error(err);
            }
        };
        fetchAll();
    }, [month, year]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;

        const days = [];
        // Padding for days before the first
        for (let i = 0; i < startDay; i++) {
            days.push({ day: null, date: null });
        }
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            days.push({ day: d, date: dateStr });
        }
        return days;
    }, [month, year]);

    const leavesForDate = (dateStr) => {
        if (!dateStr) return [];
        return leaves.filter((l) => l.start_date <= dateStr && l.end_date >= dateStr);
    };

    const today = new Date().toISOString().split("T")[0];

    return (
        <div className="animate-fade-in" data-testid="calendar-page">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Leave Calendar
                </h1>
                <p className="text-slate-500 mt-1 text-sm">View approved leaves across the team</p>
            </div>

            <Card className="app-card">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-200" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {MONTHS[month]} {year}
                        </CardTitle>
                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={prevMonth}
                                className="rounded-lg h-8 w-8 p-0 border-slate-200 dark:border-slate-700"
                                data-testid="prev-month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={nextMonth}
                                className="rounded-lg h-8 w-8 p-0 border-slate-200 dark:border-slate-700"
                                data-testid="next-month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 mt-3">
                        {Object.entries(categoryConfig).map(([type, cfg]) => (
                            <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                            </div>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {DAYS.map((d) => (
                            <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {calendarDays.map((cell, idx) => {
                            const dayLeaves = leavesForDate(cell.date);
                            const isToday = cell.date === today;
                            const isWeekend = cell.day && new Date(cell.date + "T00:00:00").getDay() % 6 === 0;

                            return (
                                <div
                                    key={idx}
                                    className={`min-h-[80px] md:min-h-[100px] p-1.5 rounded-lg border transition-colors ${cell.day
                                        ? isToday
                                            ? "border-slate-400 bg-slate-50 dark:bg-slate-800/50"
                                            : isWeekend
                                                ? "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50/50"
                                                : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:border-slate-700 bg-white"
                                        : "border-transparent"
                                    }`}
                                    data-testid={cell.date ? `cal-day-${cell.date}` : undefined}
                                >
                                    {cell.day && (
                                        <>
                                            <span
                                                className={`text-xs font-medium ${
                                                    isToday
                                                        ? "bg-slate-800 text-white w-6 h-6 rounded-full flex items-center justify-center"
                                                        : isWeekend
                                                            ? "text-slate-300"
                                                            : "text-slate-600 dark:text-slate-400"
                                                }`}
                                            >
                                                {cell.day}
                                            </span>
                                            <div className="mt-1 space-y-0.5">
                                                {holidays.filter(h => h.date === cell.date).map((h) => (
                                                    <div
                                                        key={h.id}
                                                        className="text-[9px] px-1 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 font-semibold truncate border border-fuchsia-200"
                                                        title={h.name}
                                                    >
                                                        🌴 {h.name}
                                                    </div>
                                                ))}
                                                {dayLeaves.slice(0, 3).map((l) => {
                                                    const category = l.category ? categoryConfig[l.category] : null;
                                                    const cfg = category || leaveTypeConfig.leave;
                                                    
                                                    let displayText = l.employee_name?.split(" ")[0] || "Leave";
                                                    if (currentUser?.role === "employee") {
                                                        displayText = category ? category.label : leaveTypeConfig.leave.label;
                                                    } else {
                                                        if (l.employee_id === currentUser?.id) {
                                                            displayText = "Self";
                                                        }
                                                    }

                                                    return (
                                                        <div
                                                            key={l.id}
                                                            className={`text-[9px] px-1 py-0.5 rounded ${cfg.bg} ${cfg.text} truncate`}
                                                            title={`${l.employee_name} - ${category ? category.label : leaveTypeConfig.leave.label}`}
                                                        >
                                                            {displayText}
                                                        </div>
                                                    );
                                                })}
                                                {dayLeaves.length > 3 && (
                                                    <span className="text-[9px] text-slate-400">+{dayLeaves.length - 3} more</span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}