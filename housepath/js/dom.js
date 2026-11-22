export function h(tag, attrs, children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === "class") node.className = value;
    else if (key === "value" && "value" in node) node.value = String(value);
    else if (key === "checked") node.checked = Boolean(value);
    else if (key === "disabled") node.disabled = Boolean(value);
    else if (key === "open") node.open = Boolean(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== false) node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of [].concat(children ?? [])) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
}
