export function getProfileFromToken() {
    const token = localStorage.getItem("token");

    if (!token || token.split('.').length !== 3) {
        console.error("Invalid token format");
        return null;
    }

    try {
        const payload = JSON.parse(atob(token.split('.')[1]));

        return {
            full_name: payload.full_name || payload.sub?.split("@")[0] || "User",
            email: payload.sub,
            role: payload.role || "super_admin",
        };
    } catch (e) {
        console.error("Invalid token decode");
        return null;
    }
}