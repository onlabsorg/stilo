// Light/dark theme: the data-theme attribute of <html>, remembered per browser.
// index.html applies the saved theme before the first paint.

const KEY = "stilo-theme";

export function currentTheme() {
    return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
        localStorage.setItem(KEY, theme);
    } catch {}
    window.dispatchEvent(new CustomEvent("theme-change", { detail: { theme } }));
}

export function toggleTheme() {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
}
