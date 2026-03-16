import * as ort from '/libs/ort.mjs';
import { AutoTokenizer, env } from '/libs/transformers.min.js';

env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL('/models/');
env.useBrowserCache = false;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = chrome.runtime.getURL('/libs/');


// Listen for the threat data from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "RUN_ANONYMIZER") {
        processAndEncryptThreat(request.text).then(() => {
            sendResponse({ success: true });
        });
        return true;
    }
});

async function processAndEncryptThreat(textToSanitize) {
    console.log("%c🛡️ [Offscreen Engine] Booting Local AI Anonymizer...", "color: #a855f7; font-weight: bold;");

    try {
        const res = await fetch(chrome.runtime.getURL('/models/local-kiji/label_mappings.json'));
        const mappingData = await res.json();
        const idToLabel = mappingData.pii.id2label;

        const tokenizer = await AutoTokenizer.from_pretrained('local-kiji', { local_files_only: true });
        const modelUrl = chrome.runtime.getURL('/models/local-kiji/model_quantized.onnx');
        const modelBuffer = await fetch(modelUrl).then(r => r.arrayBuffer());

        const session = await ort.InferenceSession.create(modelBuffer);

        const inputs = await tokenizer(textToSanitize, { truncation: true, maxLength: 512 });
        const tensorInputIds = new ort.Tensor('int64', inputs.input_ids.data, inputs.input_ids.dims);
        const tensorAttentionMask = new ort.Tensor('int64', inputs.attention_mask.data, inputs.attention_mask.dims);

        const results = await session.run({ input_ids: tensorInputIds, attention_mask: tensorAttentionMask });

        const logits = results[session.outputNames[0]];
        const [batchSize, seqLength, numLabels] = logits.dims;
        const logitsData = logits.data;
        const tokenIds = inputs.input_ids.data;

        let maskedText = "";
        let currentMask = null;

        for (let i = 0; i < seqLength; i++) {
            if (tokenIds[i] === 101n || tokenIds[i] === 102n) continue;

            let maxVal = -Infinity;
            let maxIndex = 0;
            for (let j = 0; j < numLabels; j++) {
                const val = logitsData[i * numLabels + j];
                if (val > maxVal) { maxVal = val; maxIndex = j; }
            }

            const label = idToLabel[maxIndex] || 'O';
            const word = tokenizer.decode([Number(tokenIds[i])]);

            if (label !== 'O') {
                const entityType = label.replace('B-', '').replace('I-', '');
                if (currentMask !== entityType) {
                    maskedText += `[${entityType}] `;
                    currentMask = entityType;
                }
            } else {
                currentMask = null;
                if (word.startsWith('##')) {
                    maskedText = maskedText.trimEnd() + word.substring(2) + " ";
                } else {
                    maskedText += word + " ";
                }
            }
        }

        console.log("%c🟢 Sanitized String:", "color: #22c55e;", maskedText.trim());
        await encryptAndTransmit(maskedText.trim());

    } catch (error) {
        console.error("❌ Anonymizer failed:", error);
    }
}

// --- Helper function to convert PEM text into a WebCrypto Key ---
async function importPublicKey(pemText) {
    const pemContents = pemText
        .replace("-----BEGIN PUBLIC KEY-----", "")
        .replace("-----END PUBLIC KEY-----", "")
        .replace(/\s/g, "");

    const binaryDerString = window.atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return await window.crypto.subtle.importKey(
        "spki",
        binaryDer.buffer,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );
}

async function encryptAndTransmit(sanitizedData) {
    console.log("%c🔒 [Offscreen Engine] Generating Ephemeral Keys & Encrypting...", "color: #eab308; font-weight: bold;");

    try {
        // 1. Fetch the real Public Key from the extension files
        const pemResponse = await fetch(chrome.runtime.getURL('/extension_public.pem'));
        const pemText = await pemResponse.text();
        const serverPublicKey = await importPublicKey(pemText);

        // 2. Generate One-Time AES Key
        const aesKey = await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );

        // 3. Encrypt the Sanitized String
        const encoder = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encryptedDataBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, aesKey, encoder.encode(sanitizedData)
        );

        // 4. Wrap the AES Key using the REAL RSA Public Key
        const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
        const wrappedKeyBuffer = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" }, serverPublicKey, rawAesKey
        );

        const arrayBufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const payload = {
            encryptedData: arrayBufferToBase64(encryptedDataBuffer),
            initializationVector: arrayBufferToBase64(iv),
            wrappedSessionKey: arrayBufferToBase64(wrappedKeyBuffer)
        };

        console.log("%c🚀 TRANSMITTING SECURE PAYLOAD TO SERVER...", "color: #0ea5e9; font-weight: bold;");

        // 5. Fire the payload to your new Python decryption endpoint!
        const response = await fetch("http://127.0.0.1:8000/ingest/simulator", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            console.log("%c✅ PAYLOAD SUCCESSFULLY INGESTED BY BACKEND!", "color: #22c55e; font-weight: bold;");
        } else {
            console.error("❌ Server rejected the payload:", await response.text());
        }

    } catch (error) {
        console.error("❌ Cryptography/Transmission failed:", error);
    }
}