const DB_NAME = "TheCircleKeysDB";
const DB_VERSION = 1;
const STORE_NAME = "device";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const target = event.target as IDBOpenDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in onupgradeneeded event"));
        return;
      }
      const db = target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // You can add indexes here if needed
      }
    };

    request.onsuccess = (event) => {
      const target = event.target as IDBOpenDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in onsuccess event"));
        return;
      }
      resolve(target.result);
    };

    request.onerror = (event) => {
      const target = event.target as IDBOpenDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in onerror event"));
        return;
      }
      reject(target.error);
    };
  });
}


// Save device data
async function saveDevice(device: any): Promise<boolean> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(device);

    req.onsuccess = (event: Event) => {
      const target = event.target as IDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in saveDevice onsuccess"));
        return;
      }
      resolve(true);
    };

    req.onerror = (event: Event) => {
      const target = event.target as IDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in saveDevice onerror"));
        return;
      }
      reject(target.error);
    };
  });
}

// Get device by ID
export async function getDevice(id: IDBValidKey): Promise<any> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = (event: Event) => {
      const target = event.target as IDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in getDevice onsuccess"));
        return;
      }
      resolve(target.result);
    };

    req.onerror = (event: Event) => {
      const target = event.target as IDBRequest | null;
      if (!target) {
        reject(new Error("Unexpected null target in getDevice onerror"));
        return;
      }
      reject(target.error);
    };
  });
}

export async function getDeviceName() {
    //get deviceId
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    //gen deviceId
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }

  return deviceId;
}

export async function setupDeviceKey() {
  //get deviceId
  const deviceId = await getDeviceName()

  //get device with privkey info
  let device = await getDevice(deviceId);

  if (!device) {
    // No device found — generate new key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    device = {
      id: deviceId,
      privateKey: keyPair.privateKey,
      createdAt: new Date(),
    };

    await saveDevice(device);

    const token = localStorage.getItem("jwt_token");

    const pubKey = await exportPublicKey(keyPair.publicKey);

    const pubKeyBody = {
      publicKey: pubKey,
      deviceId: deviceId,
    };
    
    console.log("tejaskl;fjds;alkfjask;ljf");
    //send public key and deviceId to db
    await fetch(`https://localhost:3002/api/user/registerPubKey`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify(pubKeyBody),
    });
  }

  return device;
}

export async function exportPublicKey(key) {
  const spki = await window.crypto.subtle.exportKey("spki", key);
  return btoa(String.fromCharCode(...new Uint8Array(spki)));
}

export async function importPublicKey(spkiB64) {
	const binary = Uint8Array.from(atob(spkiB64), (c) => c.charCodeAt(0));
	return window.crypto.subtle.importKey(
		"spki",
		binary,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		true,
		["verify"]
	);
}

export async function exportPrivateKey(key) {
	const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", key);
	return btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
}

export async function importPrivateKey(pkcs8B64) {
	const binary = Uint8Array.from(atob(pkcs8B64), (c) => c.charCodeAt(0));
	return window.crypto.subtle.importKey(
		"pkcs8",
		binary,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		true,
		["sign"]
	);
}
