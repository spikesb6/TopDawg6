function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("The save was aborted."));
  });
}

export function createStore() {
  let opening;
  function open() {
    if (!opening) {
      opening = new Promise((resolve, reject) => {
        const req = indexedDB.open("housepath", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
          if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          opening = undefined;
          reject(req.error);
        };
      });
    }
    return opening;
  }

  async function write(names, run) {
    const db = await open();
    const tx = db.transaction(names, "readwrite");
    run(tx);
    await transactionDone(tx);
  }

  return {
    async load() {
      const db = await open();
      const tx = db.transaction("meta", "readonly");
      const value = await request(tx.objectStore("meta").get("state"));
      await transactionDone(tx);
      return value || null;
    },
    async save(state) {
      await write("meta", (tx) => tx.objectStore("meta").put(state, "state"));
    },
    async listFiles() {
      const db = await open();
      const tx = db.transaction("files", "readonly");
      const rows = await request(tx.objectStore("files").getAll());
      await transactionDone(tx);
      return rows || [];
    },
    async addFile(file) {
      await write("files", (tx) => tx.objectStore("files").put(file));
    },
    async removeFile(id) {
      await write("files", (tx) => tx.objectStore("files").delete(id));
    },
    async clear() {
      await write(["meta", "files"], (tx) => {
        tx.objectStore("meta").clear();
        tx.objectStore("files").clear();
      });
    },
  };
}
