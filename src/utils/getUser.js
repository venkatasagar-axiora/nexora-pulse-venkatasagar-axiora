export function getUser() {
    const user = localStorage.getItem("user");

    if (!user || user === "undefined") return null;

    try {
        return JSON.parse(user);
    } catch (e) {
        console.error("Invalid user data");
        return null;
    }
}