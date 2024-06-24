const styleDataAttr = "data-transitio-style";
const configDataAttr = "data-transitio-config";
const switchDataAttr = "data-transitio-switch";
const $ = document.querySelector.bind(document);
const pluginPath = LiteLoader.plugins.transitio.path.plugin.replace(":\\", "://").replaceAll("\\", "/"); // Normalized plugin path
const dataPath = LiteLoader.plugins.transitio.path.data.replace(":\\", "://").replaceAll("\\", "/");
let isDebug = false;
let log = () => { }; // Dummy function

// Helper function for css
function injectCSS(path, css) {
    const style = document.createElement("style");
    style.setAttribute(styleDataAttr, path);
    style.textContent = css;
    document.head.appendChild(style);
    return style;
}
function cssHelper(path, css, enabled, description) {
    const current = $(`style[${styleDataAttr}="${path}"]`);
    if (current) {
        current.textContent = enabled ? css : `/* ${description || "此文件没有描述"} */`;
    } else {
        injectCSS(path, enabled ? css : `/* ${description || "此文件没有描述"} */`);
    }
}

transitio.onUpdateStyle((event, args) => {
    cssHelper(args.path, args.css, args.enabled, args.meta.description);
});
transitio.onResetStyle(() => {
    const styles = document.querySelectorAll(`style[${styleDataAttr}]`);
    styles.forEach((style) => {
        style.remove();
    });
});
transitio.rendererReady();
isDebug = await transitio.queryIsDebug();
if (isDebug) {
    log = console.log.bind(console, "[Transitio]");
}

async function onSettingWindowCreated(view) {
    log(pluginPath);
    const r = await fetch(`local:///${pluginPath}/settings.html`);
    const $ = view.querySelector.bind(view);
    view.innerHTML = await r.text();
    const container = $("setting-section.snippets > setting-panel > setting-list");
    function addItem(path) { // Add a list item with name and description, returns the switch
        const item = container.appendChild(document.createElement("setting-item"));
        item.setAttribute("data-direction", "row");
        item.setAttribute(configDataAttr, path);
        const left = item.appendChild(document.createElement("div"));
        const itemName = left.appendChild(document.createElement("setting-text"));
        const itemDesc = document.createElement("setting-text");
        itemDesc.setAttribute("data-type", "secondary");
        left.appendChild(itemDesc);
        const right = item.appendChild(document.createElement("div"));
        right.classList.add("transitio-menu");
        const remove = right.appendChild(document.createElement("span"));
        remove.textContent = "🗑️";
        remove.classList.add("transitio-more");
        remove.title = "删除此样式";
        remove.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                transitio.removeStyle(path);
            }
        });
        const showInFolder = right.appendChild(document.createElement("span"));
        showInFolder.textContent = "📂";
        showInFolder.classList.add("transitio-more");
        showInFolder.title = "在文件夹中显示";
        showInFolder.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                transitio.open("show", path);
            }
        });
        const switch_ = right.appendChild(document.createElement("setting-switch"));
        switch_.setAttribute(switchDataAttr, path);
        switch_.title = "启用/禁用此样式";
        switch_.addEventListener("click", () => {
            if (!item.hasAttribute("data-deleted")) {
                switch_.parentNode.classList.toggle("is-loading", true);
                transitio.configChange(path, switch_.toggleAttribute("is-active")); // Update the UI immediately, so it would be more smooth
            }
        });
        return item;
    }
    transitio.onUpdateStyle((event, args) => {
        const { path, meta, enabled } = args;
        const isDeleted = meta.name === " [已删除] ";
        const item = $(`setting-item[${configDataAttr}="${path}"]`) || addItem(path);
        const itemName = item.querySelector("setting-text");
        const optionalVersion = meta.version ? ` (v${meta.version})` : "";
        itemName.textContent = meta.name + optionalVersion;
        itemName.title = path;
        const itemDesc = item.querySelector("setting-text[data-type='secondary']");
        itemDesc.textContent = meta.description || "此文件没有描述";
        itemDesc.title = itemDesc.textContent;
        const switch_ = item.querySelector(`setting-switch[${switchDataAttr}="${path}"]`);
        switch_.toggleAttribute("is-active", enabled);
        switch_.parentNode.classList.toggle("is-loading", false);
        if (isDeleted) {
            item.toggleAttribute("data-deleted", true);
        }
        log("onUpdateStyle", path, enabled);
    });
    transitio.onResetStyle(() => {
        const items = view.querySelectorAll(`[${configDataAttr}]`);
        items.forEach((item) => {
            item.remove();
        });
    });
    function devMode() {
        const enabled = this.toggleAttribute("is-active");
        transitio.devMode(enabled);
    }
    function openURI(type, uri) {
        console.log("[Transitio] Opening", type, uri);
        transitio.open(type, uri);
    }
    function openURL() {
        const url = this.getAttribute("data-transitio-url");
        openURI("link", url);
    }
    async function importCSS() {
        if (this.files.length == 0) return; // No file selected
        this.parentNode.classList.toggle("is-loading", true);
        let cnt = 0;
        const promises = [];
        for (const file of this.files) {
            if (!file.name.endsWith(".css")) {
                console.log("[Transitio] Ignored", file.name);
                continue;
            }
            promises.push(new Promise((resolve, reject) => {
                cnt++;
                console.log("[Transitio] Importing", file.name);
                let reader = new FileReader();
                reader.onload = () => {
                    transitio.importStyle(file.name, reader.result);
                    console.log("[Transitio] Imported", file.name);
                    resolve();
                };
                reader.readAsText(file);
            }));
        }
        await Promise.all(promises);
        this.parentNode.classList.toggle("is-loading", false);
        console.log("[Transitio] Imported", cnt, "files");
        if (cnt > 0) {
            alert(`成功导入 ${cnt} 个 CSS 文件`);
        } else {
            alert("没有导入任何 CSS 文件");
        }
    }
    transitio.rendererReady(); // We don't have to create a new function for this 😉
    const dev = $("#transitio-dev");
    dev.addEventListener("click", devMode);
    transitio.queryDevMode().then(enabled => {
        log("queryDevMode", enabled);
        dev.toggleAttribute("is-active", enabled);
    });
    if (isDebug) {
        const debug = $("#transitio-debug");
        debug.style.color = "red";
        debug.title = "Debug 模式已激活";
    }
    $("#transitio-reload").addEventListener("dblclick", transitio.reloadStyle);
    $("#transitio-open-folder").addEventListener("click", () => {
        openURI("path", `${dataPath}/styles`); // Relative to the data directory
    });
    $("#transitio-import").addEventListener("change", importCSS);
    // About - Version
    $("#transitio-version").textContent = LiteLoader.plugins.transitio.manifest.version;
    // About - Backgroud image
    ["version", "author", "issues", "submit"].forEach(id => {
        $(`#transitio-about-${id}`).style.backgroundImage = `url("local:///${pluginPath}/icons/${id}.svg")`;
    });
    // Logo
    const logo = $(".logo");
    logo.src = `local:///${pluginPath}/icons/icon.svg`;
    // Easter egg
    const title = document.querySelector(".setting-title");
    function lumos() {
        document.body.classList.remove("q-theme-tokens-dark");
        document.body.classList.add("q-theme-tokens-light");
        document.body.setAttribute("q-theme", "light");
        title.classList.add("lumos");
        setTimeout(() => {
            title.classList.remove("lumos");
        }, 2000);
    }
    function nox() {
        document.body.classList.remove("q-theme-tokens-light");
        document.body.classList.add("q-theme-tokens-dark");
        document.body.setAttribute("q-theme", "dark");
        title.classList.add("nox");
        setTimeout(() => {
            title.classList.remove("nox");
        }, 2000);
    }
    function currentTheme() {
        return document.body.getAttribute("q-theme");
    }
    logo.addEventListener("animationend", () => {
        document.startViewTransition(() => {
            if (currentTheme() == "light") {
                nox();
            } else {
                lumos();
            }
        });
    });
    // Links
    view.querySelectorAll(".transitio-link").forEach(link => {
        if (!link.getAttribute("title")) {
            link.setAttribute("title", link.getAttribute("data-transitio-url"));
        }
        link.addEventListener("click", openURL);
    });
}

export {
    onSettingWindowCreated
}