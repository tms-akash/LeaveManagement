import { NavLink } from "react-router-dom";
import { useUser } from "../context/UserContext";
import {
    LayoutDashboard,
    CalendarPlus,
    FileText,
    Users,
    CalendarDays,
    ClipboardCheck,
    LogOut,
    Palmtree,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "../components/ui/badge";
import { useState, useEffect } from "react";
import axios from "axios";

const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/apply-leave", icon: CalendarPlus, label: "Apply Leave" },
    { to: "/my-leaves", icon: FileText, label: "My Leaves" },
    { to: "/team-leaves", icon: ClipboardCheck, label: "Team Leaves", roles: ["admin", "manager"] },
    { to: "/calendar", icon: CalendarDays, label: "Calendar" },
    { to: "/employees", icon: Users, label: "Employees", roles: ["admin"] },
    { to: "/holidays", icon: Palmtree, label: "Holidays", roles: ["admin"] },
];

const roleColors = {
    admin: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20",
    manager: "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-500/20",
    employee: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
};

export default function Layout({ children }) {
    const { currentUser, logout } = useUser();
    const [notifications, setNotifications] = useState({ my_leaves: 0, team_leaves: 0 });

    useEffect(() => {
        if (!currentUser) return;
        const fetchNotifs = async () => {
            try {
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leaves/notifications`);
                setNotifications(res.data);
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
            }
        };
        fetchNotifs();
        const interval = setInterval(fetchNotifs, 3000); 
        return () => clearInterval(interval);
    }, [currentUser]);

    const filteredNav = navItems.filter(
        (item) => !item.roles || (currentUser && item.roles.includes(currentUser.role))
    );

    const SidebarContent = () => (
        <>
            {/* Logo */}
            <div className="mb-8">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    LeaveDesk
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">Leave Management</p>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-1 flex-1">
                {filteredNav.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === "/"}
                        className={({ isActive }) =>
                            `nav-link flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? "bg-slate-100 dark:bg-slate-800 font-medium text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`
                        }
                        data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                    >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="flex-1 text-sm">{item.label}</span>
                        {item.label === "My Leaves" && notifications.my_leaves > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{notifications.my_leaves}</span>
                        )}
                        {item.label === "Team Leaves" && notifications.team_leaves > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">{notifications.team_leaves}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* User Info & Logout */}
            <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                {currentUser && (
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{currentUser.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{currentUser.department}</p>
                        <Badge className={`mt-2 text-[10px] border ${roleColors[currentUser.role]}`}>
                            {currentUser.role}
                        </Badge>
                    </div>
                )}
                <div className="flex gap-2">
                    <button
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-500/30 transition-colors"
                    >
                        <LogOut className="w-4 h-4" /> Sign out
                    </button>
                    <ThemeToggle />
                </div>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-background">
            {/* Desktop Sidebar */}
            <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-card border-r border-slate-200 dark:border-border p-6 flex-col gap-2 z-50 hidden lg:flex">
                <SidebarContent />
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 w-full bg-white/80 dark:bg-card/80 backdrop-blur-md border-b border-white/20 dark:border-border/50 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
                <h1 className="text-lg font-bold text-slate-900 dark:text-foreground" style={{ fontFamily: 'Manrope, sans-serif' }}>LeaveDesk</h1>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    {currentUser && (
                        <Badge className={`text-[10px] px-1.5 border shadow-sm ${roleColors[currentUser.role]}`}>
                            {currentUser.role}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <main className="lg:ml-64 min-h-screen pt-16 pb-24 lg:pt-0 lg:pb-0">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/90 dark:bg-card/90 backdrop-blur-md border-t border-slate-200 dark:border-border z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_10px_rgba(0,0,0,0.2)] pb-safe">
                <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1 py-1.5 items-center justify-start sm:justify-around text-slate-500 dark:text-slate-400">
                    {filteredNav.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === "/"}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center py-2 px-3 min-w-[70px] rounded-xl relative transition-colors ${
                                    isActive ? "text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/80 dark:bg-slate-800 font-medium" : "hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                }`
                            }
                            data-testid={`mobile-nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
                        >
                            <div className="relative mb-1">
                                <item.icon className="w-5 h-5 shrink-0" />
                                {item.label === "My Leaves" && notifications.my_leaves > 0 && (
                                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 min-w-[16px] text-center rounded-full border border-white shadow-sm">{notifications.my_leaves}</span>
                                )}
                                {item.label === "Team Leaves" && notifications.team_leaves > 0 && (
                                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 min-w-[16px] text-center rounded-full border border-white shadow-sm">{notifications.team_leaves}</span>
                                )}
                            </div>
                            <span className="text-[10px] text-center whitespace-nowrap">{item.label}</span>
                        </NavLink>
                    ))}
                    <button
                        onClick={logout}
                        className="flex flex-col items-center justify-center py-2 px-3 min-w-[70px] rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                        data-testid="mobile-nav-logout"
                    >
                        <LogOut className="w-5 h-5 mb-1 shrink-0" />
                        <span className="text-[10px] text-center whitespace-nowrap">Sign out</span>
                    </button>
                </div>
            </nav>
        </div>
    );
}