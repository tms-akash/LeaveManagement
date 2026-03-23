import { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

const API = `${import.meta.env.VITE_BACKEND_URL}/api`;
const UserContext = createContext(null);

export function UserProvider({ children }) {
    const [employees, setEmployees] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Setup axios interceptor
    useEffect(() => {
        const interceptor = axios.interceptors.request.use(
            (config) => {
                const token = localStorage.getItem("token");
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        return () => axios.interceptors.request.eject(interceptor);
    }, []);

    const fetchEmployees = async () => {
        try {
            const res = await axios.get(`${API}/employees`);
            setEmployees(res.data);
            return res.data;
        } catch (err) {
            console.error("Failed to fetch employees", err);
            return [];
        }
    };

    const loadUser = async () => {
        const token = localStorage.getItem("token");
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await axios.get(`${API}/auth/me`);
            setCurrentUser(res.data);
        } catch (err) {
            console.error("Token invalid or expired", err);
            localStorage.removeItem("token");
            setCurrentUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUser();
    }, []);

    // Load employees list when a user is successfully authenticated
    useEffect(() => {
        if (currentUser) {
            fetchEmployees();
        } else {
            setEmployees([]);
        }
    }, [currentUser]);

    const login = async (email, password) => {
        try {
            const res = await axios.post(`${API}/auth/login`, { email, password });
            localStorage.setItem("token", res.data.access_token);
            setCurrentUser(res.data.user);
            toast.success("Look who it is! Ready to conquer the day?");
            return true;
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Abort mission! Those credentials don't look right.");
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem("token");
        setCurrentUser(null);
        toast.info("Safe travels! Don't work too hard while you're gone.");
    };

    return (
        <UserContext.Provider value={{ employees, currentUser, login, logout, loading, fetchEmployees }}>
            {children}
        </UserContext.Provider>
    );
}

export const useUser = () => useContext(UserContext);