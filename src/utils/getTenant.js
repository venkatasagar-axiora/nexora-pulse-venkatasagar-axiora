export function getTenant() {
    const tenant = localStorage.getItem("tenant");

    if (!tenant || tenant === "undefined") return null;

    try {
        return JSON.parse(tenant);
    } catch (e) {
        console.error("Invalid tenant data");
        return null;
    }
}