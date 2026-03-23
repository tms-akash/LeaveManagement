import { useState } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "../components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { roleColors } from "../config/leaveConfig";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

const departments = ["Engineering", "Design", "Marketing", "HR", "Finance", "Operations"];

export default function Employees() {
    const { employees, fetchEmployees } = useUser();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [form, setForm] = useState({ name: "", email: "", department: "", role: "employee", manager_id: "" });

    const filtered = employees.filter((e) => {
        const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || 
                              e.email.toLowerCase().includes(search.toLowerCase()) || 
                              e.department.toLowerCase().includes(search.toLowerCase());
        const matchesRole = roleFilter === "all" || e.role === roleFilter;
        const matchesDept = departmentFilter === "all" || e.department === departmentFilter;
        return matchesSearch && matchesRole && matchesDept;
    });

    const openAdd = () => {
        setEditingEmployee(null);
        setForm({ name: "", email: "", department: "", role: "employee", manager_id: "" });
        setDialogOpen(true);
    };

    const openEdit = (emp) => {
        setEditingEmployee(emp);
        setForm({ name: emp.name, email: emp.email, department: emp.department, role: emp.role, manager_id: emp.manager_id || "" });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.email.trim() || !form.department) {
            toast.error("Wait! We need all the details before we can save this.");
            return;
        }
        try {
            const submitData = { ...form };
            if (!submitData.manager_id) submitData.manager_id = null;

            if (editingEmployee) {
                await axios.put(`${API}/employees/${editingEmployee.id}`, submitData);
                toast.success("Fresh coat of paint! Employee details updated.");
            } else {
                // The backend EmployeeCreate model requires a password.
                // We send a default password; the backend will hash it.
                await axios.post(`${API}/employees`, { ...submitData, password: "password123" });
                toast.success("A new challenger appears! Welcome to the team.");
            }
            setDialogOpen(false);
            fetchEmployees();
        } catch (err) {
            let errorMsg = "Failed to save";
            if (err.response?.data?.detail) {
                if (Array.isArray(err.response.data.detail)) {
                    errorMsg = err.response.data.detail[0].msg;
                } else {
                    errorMsg = err.response.data.detail;
                }
            }
            toast.error(errorMsg);
        }
    };

    const handleDelete = async (emp) => {
        if (!window.confirm(`Remove ${emp.name}?`)) return;
        try {
            await axios.delete(`${API}/employees/${emp.id}`);
            toast.success("And... poof! They're gone from the records.");
            fetchEmployees();
        } catch (err) {
            toast.error("They're putting up a fight! Couldn't remove that employee.");
        }
    };

    return (
        <div className="animate-fade-in" data-testid="employees-page">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Employees
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">{employees.length} team members</p>
                </div>
                <Button
                    onClick={openAdd}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-all duration-200 active:scale-95 shadow-sm"
                    data-testid="add-employee-btn"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Employee
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search employees..."
                        className="pl-9 rounded-lg border-slate-200 dark:border-slate-700"
                        data-testid="search-employees"
                    />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] rounded-lg border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg border-slate-200 dark:border-slate-700">
                        <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Employee Grid */}
            {filtered.length === 0 ? (
                <Card className="app-card">
                    <CardContent className="py-12 text-center">
                        <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No employees found</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((emp) => (
                        <Card key={emp.id} className="app-card group" data-testid={`employee-card-${emp.id}`}>
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-600 dark:text-slate-400">
                                        {emp.name.split(" ").map((n) => n[0]).join("")}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openEdit(emp)}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors"
                                            data-testid={`edit-employee-${emp.id}`}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(emp)}
                                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                                            data-testid={`delete-employee-${emp.id}`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{emp.name}</p>
                                <p className="text-xs text-slate-500">{emp.email}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-slate-400">{emp.department}</span>
                                    <Badge className={`text-[10px] border ${roleColors[emp.role]}`}>
                                        {emp.role}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold" style={{ fontFamily: 'Manrope, sans-serif' }}>
                            {editingEmployee ? "Edit Employee" : "Add Employee"}
                        </DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            {editingEmployee ? "Update employee details" : "Add a new team member"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Full Name</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="John Doe"
                                className="rounded-lg border-slate-200 dark:border-slate-700"
                                data-testid="employee-name-input"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Email</label>
                            <Input
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="john@company.com"
                                className="rounded-lg border-slate-200 dark:border-slate-700"
                                data-testid="employee-email-input"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Department</label>
                            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                                <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700" data-testid="employee-department-select">
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {departments.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Role</label>
                            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                                <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700" data-testid="employee-role-select">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="employee">Employee</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {form.role !== "admin" && (
                            <div>
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1.5 block">Assign Manager (Optional)</label>
                                <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? "" : v })}>
                                    <SelectTrigger className="rounded-lg border-slate-200 dark:border-slate-700" data-testid="employee-manager-select">
                                        <SelectValue placeholder="No Manager Assigned" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No Manager Assigned</SelectItem>
                                        {employees
                                            .filter(e => e.role === "manager" && e.id !== editingEmployee?.id)
                                            .map((mgr) => (
                                                <SelectItem key={mgr.id} value={mgr.id}>
                                                    {mgr.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDialogOpen(false)}
                            className="rounded-lg border-slate-200 dark:border-slate-700"
                            data-testid="cancel-employee-btn"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                            data-testid="save-employee-btn"
                        >
                            {editingEmployee ? "Update" : "Add"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}