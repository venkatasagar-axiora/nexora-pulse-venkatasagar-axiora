import axios from "axios";

const API = axios.create({
    baseURL: "http://127.0.0.1:8000",
});

API.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            localStorage.removeItem("tenant");
            window.location.href = "/login";
        }
        return Promise.reject(err);
    }
);



API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});


export default API;