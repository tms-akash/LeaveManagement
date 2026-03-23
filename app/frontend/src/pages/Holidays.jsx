import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import axios from "axios";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { UploadCloud, Trash2, Download, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;

export default function Holidays() {
    const { currentUser } = useUser();
    const [holidays, setHolidays] = useState([]);
    const [uploading, setUploading] = useState(false);

    const loadHolidays = async () => {
        try {
            const res = await axios.get(`${API}/holidays`);
            setHolidays(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (currentUser?.role === "admin") {
            loadHolidays();
        }
    }, [currentUser]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        setUploading(true);
        try {
            const res = await axios.post(`${API}/holidays/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success(res.data.message);
            loadHolidays();
        } catch (err) {
            toast.error(err.response?.data?.detail || "That file is wearing a disguise! Make sure it has 'Date' and 'Holiday Name' columns.");
        } finally {
            setUploading(false);
            e.target.value = null; // reset input
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/holidays/${id}`);
            toast.success("Holiday deleted! Back to the salt mines, everyone.");
            loadHolidays();
        } catch (err) {
            toast.error("The holiday is staying put! Failed to delete.");
        }
    };

    const downloadTemplate = () => {
        const csvContent = "data:text/csv;charset=utf-8,Date,Holiday Name\n2026-01-01,New Year's Day\n2026-12-25,Christmas Day";
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Holiday_Template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (currentUser?.role !== "admin") {
        return (
            <div className="p-8 text-center text-slate-500">
                You do not have permission to view this page.
            </div>
        );
    }

    return (
        <div className="animate-fade-in max-w-4xl" data-testid="holidays-page">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        Company Holidays
                    </h1>
                    <p className="text-slate-500 mt-1 text-sm">Manage annual company-wide holidays.</p>
                </div>
                <Button 
                    variant="outline" 
                    onClick={downloadTemplate}
                    className="flex items-center gap-2 border-slate-200 dark:border-slate-700"
                >
                    <Download className="w-4 h-4" /> Download Template
                </Button>
            </div>

            <Card className="app-card mb-8 border-dashed border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                    <div className="p-4 bg-indigo-50 rounded-full mb-4">
                        <UploadCloud className="w-8 h-8 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">Upload Holiday File</h3>
                    <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                        Upload a .csv or .xlsx file containing two columns exactly named <strong className="text-slate-700 dark:text-slate-300">Date</strong> and <strong className="text-slate-700 dark:text-slate-300">Holiday Name</strong>.
                    </p>
                    
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".csv, .xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                            disabled={uploading}
                        />
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[150px]"
                            disabled={uploading}
                        >
                            {uploading ? "Uploading..." : "Select File"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="app-card">
                <CardHeader className="border-b bg-slate-50 dark:bg-slate-800/50/50 pb-4">
                    <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        Current Holidays ({holidays.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {holidays.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">
                            No holidays configured yet.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {holidays.map((h) => (
                                <div key={h.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:bg-slate-800/50 transition-colors">
                                    <div>
                                        <p className="font-semibold text-slate-800 dark:text-slate-200">{h.name}</p>
                                        <p className="text-sm text-slate-500 mt-0.5">{format(new Date(h.date + "T00:00:00"), "MMMM do, yyyy")}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDelete(h.id)}
                                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
