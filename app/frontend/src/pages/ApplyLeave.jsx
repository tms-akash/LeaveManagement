import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Calendar } from "../components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { CalendarIcon, Thermometer, Coffee, Award, Send } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

import { leaveTypeConfig, categoryConfig } from "../config/leaveConfig";

const categoryOptions = Object.entries(categoryConfig).map(([value, config]) => ({
    value,
    ...config
}));

function calcDays(start, end, holidays = []) {
    if (!start || !end) return 0;
    let days = 0;
    let current = new Date(start);
    const endDate = new Date(end);
    current.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Convert holiday list to set of dates
    const holidaySet = new Set(holidays.map(h => h.date));

    while (current <= endDate) {
        const dateStr = format(current, "yyyy-MM-dd");
        if (current.getDay() !== 0 && current.getDay() !== 6 && !holidaySet.has(dateStr)) { 
            days++;
        }
        current.setDate(current.getDate() + 1);
    }
    return days;
}

export default function ApplyLeave() {
    const { currentUser } = useUser();
    const navigate = useNavigate();
    const [category, setCategory] = useState("");
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [reason, setReason] = useState("");
    const [balance, setBalance] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [startOpen, setStartOpen] = useState(false);
    const [endOpen, setEndOpen] = useState(false);
    const [existingLeaves, setExistingLeaves] = useState([]);
    const [holidaysList, setHolidaysList] = useState([]);

    useEffect(() => {
        if (!currentUser) return;
        const load = async () => {
            try {
                const [balRes, leavesRes, holRes] = await Promise.all([
                    axios.get(`${API}/leaves/balance/${currentUser.id}`),
                    axios.get(`${API}/leaves/employee/${currentUser.id}`),
                    axios.get(`${API}/holidays`)
                ]);
                setBalance(balRes.data);
                const activeLeaves = leavesRes.data.filter(l => l.status === "pending" || l.status === "approved");
                setExistingLeaves(activeLeaves);
                setHolidaysList(holRes.data);
            } catch (err) {
                console.error("Failed to load user data for leave apply", err);
            }
        }
        load();
    }, [currentUser]);

    const isDateDisabled = (date) => {
        if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
        const dateStr = format(date, "yyyy-MM-dd");
        return existingLeaves.some(l => dateStr >= l.start_date && dateStr <= l.end_date);
    };

    const isEndDateDisabled = (date) => {
        if (isDateDisabled(date)) return true;
        if (startDate && date < new Date(new Date(startDate).setHours(0, 0, 0, 0))) return true;
        
        if (startDate) {
            const startStr = format(startDate, "yyyy-MM-dd");
            const endStr = format(date, "yyyy-MM-dd");
            return existingLeaves.some(l => l.start_date > startStr && l.start_date <= endStr);
        }
        return false;
    };

    // Calculate LOP Days dynamically
    let lopDays = 0;
    let requestedDays = 0;
    if (startDate && endDate && balance) {
        requestedDays = calcDays(startDate, endDate, holidaysList);
        const total = balance["leave"] || 18;
        const used = balance["leave_used"] || 0;
        const available = Math.max(0, total - used);
        if (requestedDays > available) {
            lopDays = requestedDays - available;
        }
    }

    const handleSubmit = async () => {
        if (!category || !startDate || !endDate || !reason.trim()) {
            toast.error("Whoa there! Don't leave us hanging—fill out the mandatory blanks.");
            return;
        }
        if (endDate < startDate) {
            toast.error("Time travel isn't supported yet! End date must be after start date.");
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${API}/leaves`, {
                employee_id: currentUser.id,
                category: category,
                start_date: format(startDate, "yyyy-MM-dd"),
                end_date: format(endDate, "yyyy-MM-dd"),
                reason: reason.trim(),
            });
            toast.success("Request sent! Now, start dreaming of that beach...");
            navigate("/my-leaves");
        } catch (err) {
            toast.error(err.response?.data?.detail || "Computer says no. We couldn't submit that request.");
        } finally {
            setSubmitting(false);
        }
    };

    if (!currentUser) return null;

    return (
        <div className="animate-fade-in max-w-2xl" data-testid="apply-leave-page">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Apply for Leave
                </h1>
                <p className="text-slate-500 mt-1 text-sm">Submit a new leave request</p>
            </div>

            {/* Balance Summary */}
            {balance && (
                <div className="mb-6">
                    {(() => {
                        const config = leaveTypeConfig.leave;
                        const total = balance.leave || 18;
                        const used = balance.leave_used || 0;
                        const remaining = total - used;
                        return (
                            <div className={`p-4 rounded-lg border ${config.bg} ${config.text} flex items-center justify-between shadow-sm`} data-testid="balance-preview-leave">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-md ${config.bgStrong}`}>
                                        <config.icon className={`w-5 h-5 ${config.iconColor}`} />
                                    </div>
                                    <div>
                                        <p className="font-semibold">{config.label} Balance</p>
                                        <p className="text-sm opacity-80">Total available days for the year</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold tracking-tight">{remaining}<span className="text-sm font-normal opacity-60 ml-1">/ {total} used: {used}</span></p>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            <Card className="app-card">
                <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200">Leave Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                    {/* Leave Category (Optional) */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Leave Category</label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700" data-testid="leave-category-select">
                                <SelectValue placeholder="Select a category (e.g. Sick, Casual)" />
                            </SelectTrigger>
                            <SelectContent>
                                {categoryOptions.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value} data-testid={`leave-category-${cat.value}`}>
                                        <span className="flex items-center gap-2">
                                            <cat.icon className="w-4 h-4 text-slate-500" />
                                            {cat.label}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Start Date</label>
                            <Popover open={startOpen} onOpenChange={setStartOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal rounded-lg border-slate-200 dark:border-slate-700"
                                        data-testid="start-date-picker"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                                        {startDate ? format(startDate, "MMM dd, yyyy") : "Pick a date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={startDate}
                                        onSelect={(d) => { setStartDate(d); setStartOpen(false); }}
                                        disabled={isDateDisabled}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">End Date</label>
                            <Popover open={endOpen} onOpenChange={setEndOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal rounded-lg border-slate-200 dark:border-slate-700"
                                        data-testid="end-date-picker"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                                        {endDate ? format(endDate, "MMM dd, yyyy") : "Pick a date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={endDate}
                                        onSelect={(d) => { setEndDate(d); setEndOpen(false); }}
                                        disabled={isEndDateDisabled}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* LOP Warning Indicator */}
                    {lopDays > 0 && (
                        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm flex items-start gap-3">
                            <Thermometer className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold mb-1">Loss of Pay (LOP) Notice</p>
                                <p>You are requesting {requestedDays} days, but only have {requestedDays - lopDays} available. <br/> <strong>{lopDays} day(s) will be marked as Loss of Pay (LOP)</strong>.</p>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2 block">Reason</label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Briefly describe the reason for your leave..."
                            className="rounded-lg border-slate-200 dark:border-slate-700 min-h-[100px] resize-none"
                            data-testid="leave-reason"
                        />
                    </div>

                    {/* Submit */}
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !startDate || !endDate || !reason.trim()}
                        className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all duration-200 active:scale-[0.98]"
                        data-testid="submit-leave-btn"
                    >
                        {submitting ? "Submitting..." : (
                            <span className="flex items-center gap-2">
                                <Send className="w-4 h-4" />
                                Submit Request
                            </span>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}