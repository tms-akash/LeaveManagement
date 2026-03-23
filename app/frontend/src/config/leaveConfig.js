import { CalendarDays, Thermometer, Coffee, Plane, Activity } from "lucide-react";

export const leaveTypeConfig = {
    leave: {
        label: "Annual",
        icon: CalendarDays,
        bg: "bg-indigo-50 dark:bg-indigo-500/20",
        bgStrong: "bg-indigo-100 dark:bg-indigo-600/30",
        text: "text-indigo-700 dark:text-indigo-400",
        border: "border-indigo-200 dark:border-indigo-500/30",
        iconColor: "text-indigo-500 dark:text-indigo-400",
        barColor: "bg-indigo-400 dark:bg-indigo-500",
        dot: "bg-indigo-400 dark:bg-indigo-500",
    }
};

export const categoryConfig = {
    sick: {
        label: "Sick",
        icon: Thermometer,
        badge: "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
        bg: "bg-rose-50 dark:bg-rose-500/20",
        text: "text-rose-700 dark:text-rose-400",
        dot: "bg-rose-500",
        barColor: "bg-rose-400 dark:bg-rose-500",
    },
    casual: {
        label: "Casual",
        icon: Coffee,
        badge: "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
        bg: "bg-amber-50 dark:bg-amber-500/20",
        text: "text-amber-700 dark:text-amber-400",
        dot: "bg-amber-500",
        barColor: "bg-amber-400 dark:bg-amber-500",
    },
    personal: {
        label: "Personal",
        icon: Plane,
        badge: "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
        bg: "bg-emerald-50 dark:bg-emerald-500/20",
        text: "text-emerald-700 dark:text-emerald-400",
        dot: "bg-emerald-500",
        barColor: "bg-emerald-400 dark:bg-emerald-500",
    },
    emergency: {
        label: "Emergency",
        icon: Activity,
        badge: "bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30",
        bg: "bg-red-50 dark:bg-red-500/20",
        text: "text-red-700 dark:text-red-400",
        dot: "bg-red-500",
        barColor: "bg-red-400 dark:bg-red-500",
    }
};

export const statusConfig = {
    pending: "bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30",
    approved: "bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30",
    rejected: "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30",
};

export const roleColors = {
    admin: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    manager: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20",
    employee: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};
