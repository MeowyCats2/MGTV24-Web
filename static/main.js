for (const time of document.getElementsByTagName("time")) {
	const date = new Date(time.getAttribute("datetime"));
    const format = time.dataset.format;
    let text = "";
    switch (format) {
    case "R":
        text = date.toLocaleString('en-US', { dateStyle: "medium", timeStyle: "short" });
        break;
    case "D":
        text = date.toLocaleString('en-US', { dateStyle: "medium" });
        break;
    case "d":
        text = date.toLocaleString('en-US', { dateStyle: "short" });
        break;
    case "T":
        text = date.toLocaleString('en-US', { timeStyle: "medium" });
        break;
    case "t":
        text = date.toLocaleString('en-US', { timeStyle: "short" });
        break;
    case "F":
        text = date.toLocaleString('en-US', { dateStyle: "long", timeStyle: "medium" });
        break;
    case "f":
        text = date.toLocaleString('en-US', { dateStyle: "medium", timeStyle: "short" })
        break;
    default:
        text = date.toString() + " (" + format + ")"  ;  
    };
    time.textContent = text;
};