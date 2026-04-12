(function initializePersonalizationImageStore() {
    const DB_NAME = "arteno-personalization-images";
    const STORE_NAME = "uploads";
    const DB_VERSION = 1;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("O navegador nao suporta armazenamento local de imagens."));
                return;
            }

            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error || new Error("Nao foi possivel abrir o armazenamento local."));
            request.onupgradeneeded = () => {
                const database = request.result;

                if (!database.objectStoreNames.contains(STORE_NAME)) {
                    database.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
    }

    async function withStore(mode, callback) {
        const database = await openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, mode);
            const store = transaction.objectStore(STORE_NAME);

            transaction.oncomplete = () => {
                database.close();
            };
            transaction.onerror = () => {
                reject(transaction.error || new Error("Nao foi possivel acessar o armazenamento local."));
                database.close();
            };

            Promise.resolve(callback(store)).then(resolve).catch(reject);
        });
    }

    async function saveFile(file) {
        const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const record = {
            id,
            file,
            createdAt: new Date().toISOString(),
            name: String(file?.name || "").trim(),
            type: String(file?.type || "").trim()
        };

        await withStore("readwrite", (store) => new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error("Nao foi possivel salvar a imagem temporaria."));
        }));

        return {
            id,
            name: record.name,
            type: record.type
        };
    }

    async function getFile(id) {
        if (!id) {
            return null;
        }

        const record = await withStore("readonly", (store) => new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error("Nao foi possivel ler a imagem temporaria."));
        }));

        return record?.file || null;
    }

    async function deleteFile(id) {
        if (!id) {
            return;
        }

        await withStore("readwrite", (store) => new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error("Nao foi possivel remover a imagem temporaria."));
        }));
    }

    window.personalizationImageStore = {
        saveFile,
        getFile,
        deleteFile
    };
}());
