import z from "@deepseek-ai/schemastery";
import { INVALID_CREDENTIAL_CODE, LlmAdapter, LlmError, RetryPolicySchema, assertUsableApiKey, attributionHeaders, normalizeApiKey, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { deepEqualJson, installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
//#region lib/types/json-record.js
/** Client-safe JSON object guard shared by Host parsers and browser decoders. */
/** True for a plain object that can be JSON-decoded field-wise. */
function isJsonRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region lib/types/client-contract.js
/** Browser-safe constants and JSON decoders shared by the Host and client plugin faces. */
/** Settings namespace owned by the OpenCode Go plugin. */
const OPENCODE_GO_SETTINGS_NAMESPACE = "llm-opencode-go";
/** Provider route owned by the OpenCode Go plugin. */
const OPENCODE_GO_PROVIDER = "opencode-go";
/** Credential reference used when the settings section names none. */
const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Public OpenCode Go API base URL. */
const OPENCODE_GO_PUBLIC_BASE_URL = "https://opencode.ai/zen/go/v1";
/** Default context capacity for models without documented or discovered metadata. */
const OPENCODE_GO_DEFAULT_CONTEXT_WINDOW = 262144;
/** Default maximum idle interval while a stream read is outstanding. */
const OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** Private Connection RPC channel used by this package's two runtime faces. */
const OPENCODE_GO_RPC_CHANNEL = "/opencode-go";
/** Provider-management settings snapshot endpoint. */
const OPENCODE_GO_SETTINGS_READ_ENDPOINT = "settings/read";
/** Rich model-discovery endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
const OPENCODE_GO_DISCOVER_ENDPOINT = "models/discover";
/** Revision-fenced settings-save endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
const OPENCODE_GO_SAVE_ENDPOINT = "settings/save";
/** Value-free credential status endpoint. */
const OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT = "credentials/status";
/** One-way credential write endpoint. */
const OPENCODE_GO_CREDENTIAL_SET_ENDPOINT = "credentials/set";
/** Subscription usage-snapshot endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
const OPENCODE_GO_USAGE_ENDPOINT = "usage/read";
function optionalPositiveInteger(value) {
	return value === void 0 || typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function isOpenCodeGoApi(value) {
	return value === "openai-completions" || value === "openai-responses" || value === "anthropic-messages";
}
/** Narrow one model crossing the settings or plugin-RPC JSON boundary. */
function decodeOpenCodeGoCatalogModel(value) {
	if (!isJsonRecord(value) || typeof value.id !== "string" || value.id.length === 0) return void 0;
	const name = value.name;
	const description = value.description;
	const contextWindow = value.contextWindow;
	const maxTokens = value.maxTokens;
	const vision = value.vision;
	const thinking = value.thinking;
	const defaultEffort = value.defaultEffort;
	const tools = value.tools;
	const protocol = value.api;
	if (name !== void 0 && typeof name !== "string") return void 0;
	if (description !== void 0 && typeof description !== "string") return void 0;
	if (!optionalPositiveInteger(contextWindow) || !optionalPositiveInteger(maxTokens)) return void 0;
	if (vision !== void 0 && typeof vision !== "boolean") return void 0;
	if (thinking !== void 0 && typeof thinking !== "boolean") return void 0;
	if (defaultEffort !== void 0 && (typeof defaultEffort !== "string" || defaultEffort.length === 0)) return void 0;
	if (tools !== void 0 && typeof tools !== "boolean") return void 0;
	if (protocol !== void 0 && !isOpenCodeGoApi(protocol)) return void 0;
	return {
		id: value.id,
		...name === void 0 ? {} : { name },
		...description === void 0 ? {} : { description },
		...contextWindow === void 0 ? {} : { contextWindow },
		...maxTokens === void 0 ? {} : { maxTokens },
		...vision === void 0 ? {} : { vision },
		...thinking === void 0 ? {} : { thinking },
		...defaultEffort === void 0 ? {} : { defaultEffort },
		...protocol === void 0 ? {} : { api: protocol },
		...tools === void 0 ? {} : { tools }
	};
}
/** Narrow the redacted, schema-resolved settings section before it enters React state. */
function decodeOpenCodeGoSettings(value) {
	if (!isJsonRecord(value)) return void 0;
	const apiKeyEnv = value.apiKeyEnv;
	const baseURL = value.baseURL;
	const models = value.models;
	const maxTokens = value.maxTokens;
	const defaultContextWindow = value.defaultContextWindow;
	const streamIdleTimeoutMs = value.streamIdleTimeoutMs;
	if (typeof apiKeyEnv !== "string" || apiKeyEnv.length === 0) return void 0;
	if (typeof baseURL !== "string" || baseURL.length === 0) return void 0;
	if (!Array.isArray(models)) return void 0;
	if (!optionalPositiveInteger(maxTokens)) return void 0;
	if (!optionalPositiveInteger(defaultContextWindow) || defaultContextWindow === void 0) return void 0;
	if (typeof streamIdleTimeoutMs !== "number" || !Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0) return;
	const decodedModels = [];
	for (const model of models) {
		const decoded = decodeOpenCodeGoCatalogModel(model);
		if (decoded === void 0) return void 0;
		decodedModels.push(decoded);
	}
	return {
		apiKeyEnv,
		baseURL,
		models: decodedModels,
		...maxTokens === void 0 ? {} : { maxTokens },
		defaultContextWindow,
		streamIdleTimeoutMs
	};
}
/** Narrow the rich discovery request received by the Host plugin. */
function decodeOpenCodeGoDiscoveryRequest(value) {
	if (!isJsonRecord(value)) return void 0;
	if (value.baseURL !== void 0 && (typeof value.baseURL !== "string" || value.baseURL.length === 0)) return void 0;
	return { ...value.baseURL === void 0 ? {} : { baseURL: value.baseURL } };
}
/** Narrow the Host discovery reply before the picker renders it. */
function decodeOpenCodeGoDiscoveryResult(value) {
	if (!isJsonRecord(value) || !Array.isArray(value.models)) return void 0;
	const models = [];
	for (const item of value.models) {
		const model = decodeOpenCodeGoCatalogModel(item);
		if (model === void 0) return void 0;
		models.push(model);
	}
	return { models };
}
/** Narrow the atomic save request. */
function decodeOpenCodeGoSaveRequest(value) {
	if (!isJsonRecord(value)) return void 0;
	const expectedRevision = value.expectedRevision;
	if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return void 0;
	if (typeof value.baseURL !== "string" || value.baseURL.length === 0 || !Array.isArray(value.models)) return void 0;
	const models = [];
	for (const item of value.models) {
		const model = decodeOpenCodeGoCatalogModel(item);
		if (model === void 0) return void 0;
		models.push(model);
	}
	return {
		baseURL: value.baseURL,
		models,
		expectedRevision
	};
}
/** Decode provider settings/credential management snapshot. */
function decodeOpenCodeGoSettingsReadResult(value) {
	if (!isJsonRecord(value) || !isJsonRecord(value.credential)) return void 0;
	const base = decodeOpenCodeGoSaveResult(value);
	if (base === void 0 || typeof value.credential.configured !== "boolean" || typeof value.credential.writable !== "boolean") return void 0;
	return {
		...base,
		credential: {
			configured: value.credential.configured,
			writable: value.credential.writable
		}
	};
}
function decodeOpenCodeGoCredentialSetRequest(value) {
	return isJsonRecord(value) && typeof value.apiKey === "string" && value.apiKey.trim().length > 0 ? { apiKey: value.apiKey } : void 0;
}
/** Narrow the Host save reply. */
function decodeOpenCodeGoSaveResult(value) {
	if (!isJsonRecord(value) || !Number.isSafeInteger(value.revision) || value.revision < 0) return void 0;
	const settings = decodeOpenCodeGoSettings(value.settings);
	return settings === void 0 ? void 0 : {
		settings,
		revision: value.revision
	};
}
function decodeUsageWindow(value) {
	if (!isJsonRecord(value) || typeof value.usage !== "number" || !Number.isFinite(value.usage) || value.usage < 0) return void 0;
	const models = [];
	if (value.models !== void 0) {
		if (!Array.isArray(value.models)) return void 0;
		for (const entry of value.models) {
			if (!isJsonRecord(entry) || typeof entry.name !== "string" || entry.name.length === 0) return void 0;
			if (typeof entry.requestCount !== "number" || !Number.isSafeInteger(entry.requestCount) || entry.requestCount < 0) return void 0;
			models.push({
				name: entry.name,
				requestCount: entry.requestCount
			});
		}
	}
	if (value.resetsAt !== void 0 && typeof value.resetsAt !== "string") return void 0;
	return {
		usage: value.usage,
		models,
		...value.resetsAt === void 0 ? {} : { resetsAt: value.resetsAt }
	};
}
/** Decode the secret-free usage snapshot returned by the Host. */
function decodeOpenCodeGoUsageView(value) {
	if (!isJsonRecord(value) || typeof value.fetchedAt !== "string") return void 0;
	const view = { fetchedAt: value.fetchedAt };
	for (const key of [
		"session",
		"weekly",
		"monthly"
	]) {
		if (value[key] === void 0) continue;
		const window = decodeUsageWindow(value[key]);
		if (window === void 0) return void 0;
		view[key] = window;
	}
	return view;
}
/** Decode the usage RPC success payload. */
function decodeOpenCodeGoUsageReply(value) {
	if (!isJsonRecord(value) || value.status !== "ok" && value.status !== "unsupported") return void 0;
	if (value.status === "unsupported") return { status: "unsupported" };
	const usage = decodeOpenCodeGoUsageView(value.usage);
	return usage === void 0 ? void 0 : {
		status: "ok",
		usage
	};
}
//#endregion
//#region lib/types/catalog.js
const BY_ID = new Map([
	{
		id: "grok-4.6",
		name: "Grok 4.6",
		contextWindow: 5e5,
		maxTokens: 5e5,
		api: "openai-responses",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "grok"
	},
	{
		id: "grok-4.5",
		name: "Grok 4.5",
		contextWindow: 5e5,
		maxTokens: 5e5,
		api: "openai-responses",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "grok"
	},
	{
		id: "gpt-5.6-luna",
		name: "GPT 5.6 Luna",
		contextWindow: 105e4,
		maxTokens: 128e3,
		api: "openai-responses",
		vision: true,
		thinking: true,
		defaultEffort: "max",
		family: "gpt"
	},
	{
		id: "muse-spark-1.2-contributor",
		name: "Muse Spark 1.2 Contributor",
		contextWindow: 1048576,
		maxTokens: 131072,
		api: "openai-responses",
		vision: true,
		thinking: true,
		defaultEffort: "xhigh",
		family: "muse"
	},
	{
		id: "glm-5.3-flash",
		name: "GLM-5.3-Flash",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "glm"
	},
	{
		id: "glm-5.3",
		name: "GLM-5.3",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "glm"
	},
	{
		id: "glm-5.2",
		name: "GLM-5.2",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "glm"
	},
	{
		id: "glm-5.1",
		name: "GLM-5.1",
		contextWindow: 202752,
		maxTokens: 32768,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "glm"
	},
	{
		id: "glm-5",
		name: "GLM-5",
		contextWindow: 202752,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "glm"
	},
	{
		id: "kimi-k3",
		name: "Kimi K3",
		contextWindow: 1048576,
		maxTokens: 131072,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "kimi"
	},
	{
		id: "kimi-k2.7-code",
		name: "Kimi K2.7 Code",
		contextWindow: 262144,
		maxTokens: 262144,
		api: "openai-completions",
		vision: true,
		thinking: false,
		family: "kimi"
	},
	{
		id: "kimi-k2.6",
		name: "Kimi K2.6",
		contextWindow: 262144,
		maxTokens: 65536,
		api: "openai-completions",
		vision: true,
		thinking: false,
		family: "kimi"
	},
	{
		id: "kimi-k2.5",
		name: "Kimi K2.5",
		contextWindow: 262144,
		maxTokens: 65536,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "max",
		family: "kimi"
	},
	{
		id: "longcat-2.0",
		name: "LongCat-2.0",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "longcat"
	},
	{
		id: "deepseek-v4-pro",
		name: "DeepSeek V4 Pro",
		contextWindow: 1e6,
		maxTokens: 384e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "deepseek"
	},
	{
		id: "deepseek-v4-flash",
		name: "DeepSeek V4 Flash",
		contextWindow: 1e6,
		maxTokens: 384e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "deepseek"
	},
	{
		id: "deepseek-v4-flash-vision-exp",
		name: "DeepSeek V4 Flash Vision Exp",
		contextWindow: 1e6,
		maxTokens: 384e3,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "max",
		family: "deepseek"
	},
	{
		id: "mimo-v2.5",
		name: "MiMo-V2.5",
		contextWindow: 1e6,
		maxTokens: 128e3,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "mimo"
	},
	{
		id: "mimo-v2.5-pro",
		name: "MiMo-V2.5-Pro",
		contextWindow: 1048576,
		maxTokens: 128e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "mimo"
	},
	{
		id: "mimo-v2-pro",
		name: "MiMo-V2-Pro",
		contextWindow: 1048576,
		maxTokens: 131072,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "mimo"
	},
	{
		id: "mimo-v2-omni",
		name: "MiMo-V2-Omni",
		contextWindow: 262144,
		maxTokens: 65536,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "mimo"
	},
	{
		id: "hy3",
		name: "Hy3",
		contextWindow: 256e3,
		maxTokens: 64e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "hy3"
	},
	{
		id: "hy3-preview",
		name: "Hy3 Preview",
		contextWindow: 256e3,
		maxTokens: 64e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "hy3"
	},
	{
		id: "minimax-m3",
		name: "MiniMax M3",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "max",
		family: "minimax"
	},
	{
		id: "minimax-m2.7",
		name: "MiniMax M2.7",
		contextWindow: 204800,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "minimax"
	},
	{
		id: "minimax-m2.5",
		name: "MiniMax M2.5",
		contextWindow: 196608,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: false,
		thinking: true,
		defaultEffort: "max",
		family: "minimax"
	},
	{
		id: "qwen3.8-max",
		name: "Qwen3.8 Max",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	},
	{
		id: "qwen3.7-max",
		name: "Qwen3.7 Max",
		contextWindow: 1e6,
		maxTokens: 65536,
		api: "anthropic-messages",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	},
	{
		id: "qwen3.7-plus",
		name: "Qwen3.7 Plus",
		contextWindow: 1e6,
		maxTokens: 65536,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	},
	{
		id: "qwen3.6-plus",
		name: "Qwen3.6 Plus",
		contextWindow: 1e6,
		maxTokens: 65536,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	},
	{
		id: "qwen3.5-plus",
		name: "Qwen3.5 Plus",
		contextWindow: 1e6,
		maxTokens: 65536,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	}
].map((model) => [model.id, model]));
function displayName(id) {
	return id.split(/[-_/]/u).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}
/** Return the documented catalog entry for an exact model id. */
function knownModel(id) {
	return BY_ID.get(id);
}
/**
* Infer the wire protocol from official docs, then prefix families for live-only ids.
* Official mapping: grok/gpt/muse → Responses; MiniMax/Qwen → Messages; everything else → Completions.
*/
function protocolForModel(id) {
	const known = BY_ID.get(id);
	if (known !== void 0) return known.api;
	const key = id.toLowerCase();
	if (key.startsWith("grok-") || key.startsWith("gpt-") || key.startsWith("muse-")) return "openai-responses";
	if (key.startsWith("minimax-") || key.startsWith("qwen")) return "anthropic-messages";
	return "openai-completions";
}
/** Family used only by the picker overlay. */
function familyForModel(id) {
	const known = BY_ID.get(id);
	if (known !== void 0) return known.family;
	const key = id.toLowerCase();
	if (key.startsWith("grok-")) return "grok";
	if (key.startsWith("gpt-")) return "gpt";
	if (key.startsWith("glm-")) return "glm";
	if (key.startsWith("kimi-")) return "kimi";
	if (key.startsWith("qwen")) return "qwen";
	if (key.startsWith("deepseek-")) return "deepseek";
	if (key.startsWith("minimax-")) return "minimax";
	if (key.startsWith("mimo-")) return "mimo";
	if (key === "hy3" || key.startsWith("hy3-")) return "hy3";
	if (key.startsWith("longcat-")) return "longcat";
	if (key.startsWith("muse-")) return "muse";
	return "other";
}
/** Merge live listing fields with documented capacities without inventing unknown windows. */
function enrichModel(id, listed) {
	const known = BY_ID.get(id);
	const contextWindow = listed.contextWindow ?? known?.contextWindow;
	const maxTokens = listed.maxTokens ?? known?.maxTokens;
	const name = listed.name ?? known?.name ?? displayName(id);
	const vision = known?.vision === true || id.toLowerCase().includes("vision") || id.toLowerCase().includes("omni");
	const thinking = known?.thinking === true;
	return {
		id,
		name,
		...contextWindow === void 0 ? {} : { contextWindow },
		...maxTokens === void 0 ? {} : { maxTokens },
		vision,
		thinking,
		...known?.defaultEffort === void 0 ? {} : { defaultEffort: known.defaultEffort },
		api: protocolForModel(id),
		tools: true
	};
}
//#endregion
//#region lib/types/http.js
/** Byte-limited response-body reading and Host JSON/key helpers. */
/** Normalize a stored Host credential; never used for browser-supplied secrets. */
function requireUsableApiKey(raw, blankMessage) {
	const checked = normalizeApiKey(raw);
	if (checked.ok) return checked.value;
	throw new LlmError(checked.reason === "empty" ? blankMessage : "this provider's API key contains characters no HTTP header can carry; paste the raw key only", INVALID_CREDENTIAL_CODE);
}
/** Read a response as UTF-8 without buffering more than maxBytes. */
async function readBoundedText(response, maxBytes, label, code, signal) {
	const declared = Number(response.headers.get("content-length") ?? NaN);
	if (Number.isFinite(declared) && declared > maxBytes) {
		await response.body?.cancel();
		throw new LlmError(label + " returned an oversized response", code);
	}
	if (response.body === null) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = "";
	const cancelReader = () => {
		reader.cancel();
	};
	signal?.addEventListener("abort", cancelReader, { once: true });
	try {
		for (;;) {
			signal?.throwIfAborted();
			const result = await reader.read();
			if (result.done) break;
			bytes += result.value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				throw new LlmError(label + " returned an oversized response", code);
			}
			text += decoder.decode(result.value, { stream: true });
		}
		text += decoder.decode();
		return text;
	} finally {
		signal?.removeEventListener("abort", cancelReader);
		reader.releaseLock();
	}
}
//#endregion
//#region lib/types/discovery.js
/**
* Live OpenCode Go model listing. GET /models returns ids only; documented
* capacities and protocol are merged from the local catalog without inventing
* windows for unknown ids.
*/
const PUBLIC_BASE_URL = OPENCODE_GO_PUBLIC_BASE_URL;
const MAX_DISCOVERY_BYTES = 4194304;
const DISCOVERY_TIMEOUT_MS = 3e4;
function positiveInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonEmpty(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/** Parse the OpenAI-shaped listing and attach documented metadata. */
function parseOpenCodeGoModels(value) {
	const data = isJsonRecord(value) ? value.data : void 0;
	if (!Array.isArray(data)) throw new LlmError("OpenCode Go model listing has no data array", "DISCOVERY_FAILED");
	const models = [];
	const seen = /* @__PURE__ */ new Set();
	for (const raw of data) {
		if (!isJsonRecord(raw)) continue;
		const id = nonEmpty(raw.id);
		if (id === void 0 || seen.has(id)) continue;
		seen.add(id);
		const name = nonEmpty(raw.name);
		const contextWindow = positiveInteger(raw.context_length) ?? positiveInteger(raw.context_window);
		const maxTokens = positiveInteger(raw.max_output_tokens) ?? positiveInteger(raw.max_tokens);
		models.push(enrichModel(id, {
			...name === void 0 ? {} : { name },
			...contextWindow === void 0 ? {} : { contextWindow },
			...maxTokens === void 0 ? {} : { maxTokens }
		}));
	}
	return models;
}
function listingURL(baseURL) {
	return baseURL.replace(/\/+$/u, "") + "/models";
}
/** Fetch the current public model catalog. */
async function discoverModels(request, storedApiKey, fetchImpl = fetch) {
	const baseURL = (request.baseURL ?? PUBLIC_BASE_URL).replace(/\/+$/u, "");
	const supplied = request.apiKey ?? await storedApiKey?.();
	const apiKey = supplied === void 0 || supplied.trim().length === 0 ? void 0 : requireUsableApiKey(supplied, "this provider's API key is blank; enter it in Plugin configuration, or clear it to probe unauthenticated");
	const url = listingURL(baseURL);
	const timeout = AbortSignal.timeout(DISCOVERY_TIMEOUT_MS);
	const signal = request.signal === void 0 ? timeout : AbortSignal.any([request.signal, timeout]);
	let response;
	try {
		response = await fetchImpl(url, {
			method: "GET",
			headers: {
				accept: "application/json",
				...apiKey === void 0 ? {} : { authorization: "Bearer " + apiKey },
				...attributionHeaders()
			},
			redirect: "error",
			signal
		});
	} catch (error) {
		if (request.signal?.aborted) throw new LlmError("OpenCode Go model discovery aborted", "ABORTED", { cause: error });
		throw new LlmError("Could not reach OpenCode Go model catalog", "DISCOVERY_FAILED", { cause: error });
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new LlmError(url + " answered HTTP " + String(response.status), response.status === 401 || response.status === 403 ? INVALID_CREDENTIAL_CODE : "DISCOVERY_FAILED", { status: response.status });
	}
	let body;
	try {
		body = JSON.parse(await readBoundedText(response, MAX_DISCOVERY_BYTES, url, "DISCOVERY_FAILED", signal));
	} catch (error) {
		if (error instanceof LlmError) throw error;
		throw new LlmError("OpenCode Go model catalog did not return JSON", "DISCOVERY_FAILED", { cause: error });
	}
	return parseOpenCodeGoModels(body);
}
//#endregion
//#region lib/types/reasoning.js
/** Per-family OpenCode Go thinking levels and plugin-owned defaults. */
const UNSUPPORTED = null;
function pin(supported) {
	return {
		off: supported.off ?? UNSUPPORTED,
		minimal: supported.minimal ?? UNSUPPORTED,
		low: supported.low ?? UNSUPPORTED,
		medium: supported.medium ?? UNSUPPORTED,
		high: supported.high ?? UNSUPPORTED,
		xhigh: supported.xhigh ?? UNSUPPORTED,
		max: supported.max ?? UNSUPPORTED
	};
}
const OFF_HIGH_MAX = pin({
	off: "none",
	high: "high",
	max: "max"
});
const OFF_LOW_HIGH_MAX = pin({
	off: "none",
	low: "low",
	high: "high",
	max: "max"
});
const LOW_MEDIUM_HIGH = pin({
	low: "low",
	medium: "medium",
	high: "high"
});
const LOW_MEDIUM_HIGH_XHIGH_MAX = pin({
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max"
});
const MINIMAL_TO_XHIGH = pin({
	minimal: "minimal",
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh"
});
const GENERIC = pin({
	off: "none",
	low: "low",
	medium: "medium",
	high: "high",
	max: "max"
});
/** Canonical ordering used by pi-ai and the settings UI. */
const OPENCODE_GO_EFFORT_ORDER = [
	"off",
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
	"max"
];
const FAMILIES = {
	grok: {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	},
	gpt: {
		levels: LOW_MEDIUM_HIGH_XHIGH_MAX,
		defaultEffort: "medium"
	},
	muse: {
		levels: MINIMAL_TO_XHIGH,
		defaultEffort: "xhigh"
	},
	glm: {
		levels: OFF_HIGH_MAX,
		defaultEffort: "max"
	},
	kimi: {
		levels: OFF_LOW_HIGH_MAX,
		defaultEffort: "max"
	},
	qwen: {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	},
	deepseek: {
		levels: OFF_LOW_HIGH_MAX,
		defaultEffort: "max"
	},
	mimo: {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	},
	hy3: {
		levels: pin({
			off: "none",
			low: "low",
			high: "high"
		}),
		defaultEffort: "high"
	},
	minimax: {
		levels: GENERIC,
		defaultEffort: "max"
	},
	longcat: {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	}
};
function policyFor(model) {
	return FAMILIES[familyForModel(model)] ?? {
		levels: GENERIC,
		defaultEffort: "medium"
	};
}
/** Supported thinking levels for one catalog row, in canonical order. */
function openCodeGoSupportedEfforts(model) {
	if (model.thinking !== true) return [];
	const levels = policyFor(model.id).levels;
	return OPENCODE_GO_EFFORT_ORDER.filter((level) => levels[level] !== null && levels[level] !== void 0);
}
/** Thinking-level map for one catalog row, or undefined when thinking is off. */
function openCodeGoThinkingLevelMap(model) {
	if (model.thinking !== true) return void 0;
	return policyFor(model.id).levels;
}
/** Plugin-owned default effort for a known family. */
function openCodeGoDefaultEffort(model) {
	return policyFor(model).defaultEffort;
}
/** Attach the family or row default to a resolved model when that level is offered. */
function applyOpenCodeGoReasoningMetadata(info, model, override) {
	if (info.reasoning === void 0) return info;
	const preferred = override ?? openCodeGoDefaultEffort(model);
	if (preferred === void 0) return info;
	const defaultEffort = preferred;
	if (!info.reasoning.efforts.some((effort) => effort.id === defaultEffort)) return info;
	return {
		...info,
		reasoning: {
			...info.reasoning,
			defaultEffort
		}
	};
}
//#endregion
//#region lib/types/pi-ai-profile.js
/**
* Translate OpenCode Go connection facts into a mixed-API pi-ai profile.
* One route, three wire protocols: model.api selects Completions, Responses, or Messages.
*/
/** Wire declaration of this model's selectable thinking levels: what pi-ai
*  turns into per-model reasoning.efforts metadata for selectors. */
function reasoningEfforts(model) {
	const levels = openCodeGoSupportedEfforts(model);
	if (levels.length === 0) return void 0;
	const map = {};
	for (const level of levels) {
		if (level === "off") {
			map.off = null;
			continue;
		}
		const value = openCodeGoThinkingLevelMap(model)?.[level];
		map[level] = typeof value === "string" && value.length > 0 ? value : level;
	}
	return map;
}
const OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS = 32768;
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20971520;
const NO_COST = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0
};
function toPiAiModel(model, connection, baseUrl) {
	const api = model.api ?? protocolForModel(model.id);
	const levels = openCodeGoThinkingLevelMap(model);
	const efforts = reasoningEfforts(model);
	const shared = {
		id: model.id,
		name: model.name ?? model.id,
		provider: OPENCODE_GO_PROVIDER,
		baseUrl,
		reasoning: model.thinking === true,
		...levels === void 0 ? {} : { thinkingLevelMap: levels },
		...efforts === void 0 ? {} : { reasoningEfforts: efforts },
		input: model.vision === true ? ["text", "image"] : ["text"],
		cost: NO_COST,
		contextWindow: model.contextWindow ?? connection.defaultContextWindow,
		maxTokens: model.maxTokens ?? 32768
	};
	if (api === "openai-responses") return {
		...shared,
		api: "openai-responses",
		compat: {
			supportsDeveloperRole: false,
			supportsLongCacheRetention: false,
			supportsStrictMode: false,
			supportsOpenAIGrammarTools: false,
			supportsToolSearch: false,
			supportsExplicitPromptCacheMode: false
		}
	};
	if (api === "anthropic-messages") return {
		...shared,
		api: "anthropic-messages"
	};
	return {
		...shared,
		api: "openai-completions",
		compat: {
			supportsStore: false,
			supportsDeveloperRole: false,
			supportsReasoningEffort: true,
			supportsUsageInStreaming: true,
			maxTokensField: "max_tokens",
			thinkingFormat: "openai"
		}
	};
}
function goAuth() {
	return { apiKey: {
		name: "OpenCode Go API key",
		resolve: ({ credential }) => Promise.resolve({
			auth: credential?.key === void 0 ? {} : { apiKey: credential.key },
			source: "OpenCode Go"
		})
	} };
}
/** Resolve the complete pi-ai profile for one OpenCode Go options snapshot. */
function createOpenCodeGoPiAiProfile(connection) {
	const baseURL = connection.baseURL.replace(/\/+$/u, "");
	const models = connection.models.map((model) => toPiAiModel(model, connection, baseURL));
	const configuredMaxTokens = /* @__PURE__ */ new Map();
	if (connection.maxTokens !== void 0) for (const model of connection.models) configuredMaxTokens.set(model.id, connection.maxTokens);
	const piProvider = createProvider({
		id: OPENCODE_GO_PROVIDER,
		name: "OpenCode Go",
		baseUrl: baseURL,
		auth: goAuth(),
		models,
		api: {
			"openai-completions": openAICompletionsApi(),
			"openai-responses": openAIResponsesApi(),
			"anthropic-messages": anthropicMessagesApi()
		}
	});
	return {
		provider: OPENCODE_GO_PROVIDER,
		displayName: "OpenCode Go",
		apiKeyEnv: connection.apiKeyEnv,
		baseURL,
		defaultContextWindow: connection.defaultContextWindow,
		defaultMaxTokens: OPENCODE_GO_DEFAULT_MODEL_MAX_TOKENS,
		defaultInput: ["text"],
		streamIdleTimeoutMs: connection.streamIdleTimeoutMs,
		maxRequestImageBytes: DEFAULT_MAX_REQUEST_IMAGE_BYTES,
		requestImagePixelBudget: 4194304,
		requestImageMaxBytes: 1048576,
		retryPolicy: connection.retryPolicy,
		piProvider,
		configuredMaxTokens
	};
}
//#endregion
//#region lib/types/pi-ai-auth.js
/**
* Provide the auth services for the OpenCode Go pi-ai adapter.
*
* OpenCode Go resolves its API key through the request-local adapter hook, so this
* process-local store starts empty and is only populated if a future login
* flow writes a credential. Provider ambient auth is intentionally unavailable.
*
* @module dsh-llm-opencode-go/pi-ai-auth
*/
/**
* Create the in-memory auth services used by OpenCode Go's pi-ai adapter.
*
* @returns auth services with an empty credential store and no ambient sources.
*/
function createOpenCodeGoPiAiAuth() {
	const stored = /* @__PURE__ */ new Map();
	return {
		credentials: {
			read: (providerId) => Promise.resolve(stored.get(providerId)),
			list: () => Promise.resolve([...stored].map(([providerId, credential]) => ({
				providerId,
				type: credential.type
			}))),
			async modify(providerId, mutate) {
				const next = await mutate(stored.get(providerId));
				if (next !== void 0) stored.set(providerId, next);
				return stored.get(providerId);
			},
			delete: (providerId) => {
				stored.delete(providerId);
				return Promise.resolve();
			}
		},
		authContext: {
			env: () => Promise.resolve(void 0),
			fileExists: () => Promise.resolve(false)
		}
	};
}
//#endregion
//#region lib/types/adapter.js
/**
* OpenCode Go chat adapter. The public route stays opencode-go, while the
* wire implementation is delegated to pi-ai. Completions, Responses, and
* Messages are selected per model. Discovery and usage stay native Host calls.
*/
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS;
const DEFAULT_CONTEXT_WINDOW = OPENCODE_GO_DEFAULT_CONTEXT_WINDOW;
/** Classify documented transient OpenCode Go failures that can arrive without an HTTP status. */
function classifyOpenCodeGoTransientError(chunk) {
	if (chunk.type !== "finish" || chunk.reason.kind !== "error" || chunk.reason.failure.code !== "PI_AI_ERROR") return chunk;
	const message = chunk.reason.failure.message;
	const code = /usage limit|quota|rate.?limit/iu.test(message) ? "RATE_LIMIT" : /subscription required|unauthorized/iu.test(message) ? "AUTH" : /overloaded|temporarily unavailable|cannot be reached/iu.test(message) ? "SERVER" : void 0;
	if (code === void 0) return chunk;
	return {
		...chunk,
		reason: {
			...chunk.reason,
			failure: {
				...chunk.reason.failure,
				code
			}
		}
	};
}
/** The OpenCode Go chat adapter backed by a mixed-API pi-ai profile. */
var OpenCodeGoAdapter = class extends LlmAdapter {
	config;
	auth = createOpenCodeGoPiAiAuth();
	snapshot;
	constructor(config) {
		super();
		this.config = config;
	}
	current() {
		const options = this.config.options();
		if (this.snapshot?.options === options) return this.snapshot.adapter;
		const profile = createOpenCodeGoPiAiProfile(options);
		const profiles = /* @__PURE__ */ new Map([[OPENCODE_GO_PROVIDER, profile]]);
		const adapter = new PiAiAdapter({
			profiles: () => profiles,
			resolveApiKey: () => this.config.resolveApiKey(options),
			auth: this.auth,
			...this.config.resolveAttachments === void 0 ? {} : { resolveAttachments: this.config.resolveAttachments }
		});
		this.snapshot = {
			options,
			adapter
		};
		return adapter;
	}
	providerInfo(provider) {
		return this.current().providerInfo(provider);
	}
	providerRetryPolicy(provider) {
		return this.current().providerRetryPolicy(provider);
	}
	/**
	* Declare neutral request-image pricing when a newer Host calls an adapter built against an older peer instance.
	* @param _provider - provider route.
	* @param _model - model id.
	* @returns `undefined` so the Host uses heuristic image pricing.
	*/
	imageRequestPricing(_provider, _model) {}
	listModels(provider) {
		return this.current().listModels(provider);
	}
	async resolveModel(provider, model, signal) {
		return applyOpenCodeGoReasoningMetadata(await this.current().resolveModel(provider, model, signal), model, this.config.options().models.find((entry) => entry.id === model)?.defaultEffort);
	}
	async *stream(options) {
		for await (const chunk of this.current().stream(options)) yield classifyOpenCodeGoTransientError(chunk);
	}
	async prepareCall(provider, model, signal) {
		const delegate = this.current();
		const inner = typeof delegate.prepareCall === "function" ? await delegate.prepareCall(provider, model, signal) : {
			model: await this.resolveModel(provider, model, signal),
			stream: (options) => delegate.stream(options)
		};
		return {
			model: inner.model,
			stream: async function* (options) {
				for await (const chunk of inner.stream(options)) yield classifyOpenCodeGoTransientError(chunk);
			}
		};
	}
};
//#endregion
//#region lib/types/usage.js
/**
* Host-only OpenCode Go subscription usage. Official endpoint:
* GET https://opencode.ai/zen/go/v1/usage
* returns rolling / weekly / monthly percent windows. Never blocks chat.
*/
const DEFAULT_USAGE_REQUEST_TIMEOUT_MS = 15e3;
const OPENCODE_GO_USAGE_UNSUPPORTED = "OPENCODE_GO_USAGE_UNSUPPORTED";
const OPENCODE_GO_USAGE_FAILED = "OPENCODE_GO_USAGE_FAILED";
const MAX_USAGE_BYTES = 1048576;
function parseModelCounts(value) {
	if (!Array.isArray(value)) return [];
	const models = [];
	for (const entry of value) {
		if (!isJsonRecord(entry)) continue;
		const name = typeof entry.name === "string" && entry.name.length > 0 ? entry.name : typeof entry.model === "string" && entry.model.length > 0 ? entry.model : void 0;
		const requestCount = typeof entry.requestCount === "number" ? entry.requestCount : typeof entry.count === "number" ? entry.count : typeof entry.requests === "number" ? entry.requests : void 0;
		if (name === void 0 || requestCount === void 0 || !Number.isSafeInteger(requestCount) || requestCount < 0) continue;
		models.push({
			name,
			requestCount
		});
	}
	return models;
}
function isoInstant(value) {
	if (typeof value === "string" && value.length > 0) {
		const parsed = Date.parse(value);
		return Number.isFinite(parsed) ? new Date(parsed).toISOString() : void 0;
	}
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		const ms = value < 0xe8d4a51000 ? value * 1e3 : value;
		const date = new Date(ms);
		return Number.isNaN(date.getTime()) ? void 0 : date.toISOString();
	}
}
function parseWindow(value) {
	if (!isJsonRecord(value)) return void 0;
	const status = value.status;
	if (status !== void 0 && status !== "ok" && status !== "rate-limited") return void 0;
	let fraction;
	if (typeof value.percent === "number" && Number.isFinite(value.percent) && value.percent >= 0) fraction = value.percent / 100;
	else if (typeof value.usagePercent === "number" && Number.isFinite(value.usagePercent) && value.usagePercent >= 0) fraction = value.usagePercent / 100;
	else if (typeof value.usage === "number" && Number.isFinite(value.usage) && value.usage >= 0) fraction = value.usage > 1 ? value.usage / 100 : value.usage;
	if (fraction === void 0) return void 0;
	const resetsAt = isoInstant(value.resetsAt ?? value.resets_at ?? value.resetAt);
	return {
		usage: fraction,
		models: parseModelCounts(value.models),
		...resetsAt === void 0 ? {} : { resetsAt }
	};
}
function unwrapUsage(value) {
	if (!isJsonRecord(value)) return void 0;
	return isJsonRecord(value.usage) ? value.usage : value;
}
/** Convert the official usage reply into the secret-free snapshot the card renders. */
function parseOpenCodeGoUsage(value, url) {
	const root = unwrapUsage(value);
	if (root === void 0) throw new LlmError(url + " returned a malformed usage response", OPENCODE_GO_USAGE_FAILED);
	const session = parseWindow(root.rolling ?? root.rollingUsage ?? root.session);
	const weekly = parseWindow(root.weekly ?? root.weeklyUsage);
	const monthly = parseWindow(root.monthly ?? root.monthlyUsage);
	if (session === void 0 && weekly === void 0 && monthly === void 0) throw new LlmError(url + " returned a malformed usage response", OPENCODE_GO_USAGE_FAILED);
	return {
		fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
		...session === void 0 ? {} : { session },
		...weekly === void 0 ? {} : { weekly },
		...monthly === void 0 ? {} : { monthly }
	};
}
/** Read rolling/weekly/monthly subscription windows without issuing a model request. */
async function readOpenCodeGoUsage(request, storedApiKey, fetchImpl = fetch) {
	const baseURL = (request.baseURL ?? "https://opencode.ai/zen/go/v1").replace(/\/+$/u, "");
	const supplied = await storedApiKey?.();
	if (supplied === void 0 || supplied.trim().length === 0) throw new LlmError("OpenCode Go usage requires a configured API key", "MISSING_CREDENTIAL");
	const apiKey = requireUsableApiKey(supplied, "this provider's API key is blank; enter it in Plugin configuration first");
	const url = baseURL + "/usage";
	const timeout = AbortSignal.timeout(DEFAULT_USAGE_REQUEST_TIMEOUT_MS);
	const signal = request.signal === void 0 ? timeout : AbortSignal.any([request.signal, timeout]);
	let response;
	try {
		response = await fetchImpl(url, {
			method: "GET",
			headers: {
				accept: "application/json",
				authorization: "Bearer " + apiKey,
				...attributionHeaders()
			},
			redirect: "error",
			signal
		});
	} catch (error) {
		if (request.signal?.aborted) throw new LlmError("OpenCode Go usage read aborted by caller", "ABORTED", { cause: error });
		const detail = error instanceof Error && error.message.length > 0 ? ": " + error.message : "";
		throw new LlmError("could not reach " + url + detail, OPENCODE_GO_USAGE_FAILED, { cause: error });
	}
	if (response.status === 404) {
		await response.body?.cancel();
		throw new LlmError("this OpenCode Go endpoint does not report subscription usage", OPENCODE_GO_USAGE_UNSUPPORTED);
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new LlmError(url + " answered " + String(response.status) + (response.status === 401 || response.status === 403 ? "; check the API key" : ""), response.status === 401 || response.status === 403 ? INVALID_CREDENTIAL_CODE : OPENCODE_GO_USAGE_FAILED);
	}
	let text;
	try {
		text = await readBoundedText(response, MAX_USAGE_BYTES, url, OPENCODE_GO_USAGE_FAILED, signal);
	} catch (error) {
		if (error instanceof LlmError) throw error;
		throw new LlmError(url + " could not be read", OPENCODE_GO_USAGE_FAILED, { cause: error });
	}
	let body;
	try {
		body = JSON.parse(text);
	} catch (error) {
		throw new LlmError(url + " did not answer with JSON", OPENCODE_GO_USAGE_FAILED, { cause: error });
	}
	return parseOpenCodeGoUsage(body, url);
}
//#endregion
//#region lib/types/index.js
/**
* Register the opencode-go route with chat delegated to pi-ai. Completions,
* Responses, and Messages are selected per model. Discovery and usage stay
* native Host RPCs; keys never cross the browser.
*/
const name = "llm-opencode-go";
const inject = ["llm"];
const DEFAULT_MAX_RETRIES = 3;
const NS = settingsNamespace(OPENCODE_GO_SETTINGS_NAMESPACE);
const catalogModel = z.object({
	id: z.string().required(),
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1),
	maxTokens: z.number().step(1).min(1),
	vision: z.boolean(),
	thinking: z.boolean(),
	defaultEffort: z.string(),
	api: z.union([
		"openai-completions",
		"openai-responses",
		"anthropic-messages"
	]),
	tools: z.boolean()
});
const Config = z.object({
	apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: z.string().default(PUBLIC_BASE_URL),
	models: z.array(catalogModel).default([]),
	maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
	defaultContextWindow: z.number().step(1).min(1).default(DEFAULT_CONTEXT_WINDOW),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
	retryPolicy: RetryPolicySchema,
	remoteManagement: z.boolean().default(false)
});
function resolveModels(models) {
	const seen = /* @__PURE__ */ new Set();
	return (models ?? []).map((model) => {
		if (model.id.length === 0) throw new Error("llm-opencode-go: catalog model ids must be non-empty");
		if (model.name !== void 0 && model.name.length === 0) throw new Error("llm-opencode-go: catalog model \"" + model.id + "\" has an empty name");
		if (model.contextWindow !== void 0 && (!Number.isInteger(model.contextWindow) || model.contextWindow <= 0)) throw new Error("llm-opencode-go: catalog model \"" + model.id + "\" contextWindow must be a positive integer");
		if (model.maxTokens !== void 0 && (!Number.isInteger(model.maxTokens) || model.maxTokens <= 0)) throw new Error("llm-opencode-go: catalog model \"" + model.id + "\" maxTokens must be a positive integer");
		if (seen.has(model.id)) throw new Error("llm-opencode-go: duplicate catalog model id " + model.id);
		seen.add(model.id);
		return {
			id: model.id,
			...model.name === void 0 ? {} : { name: model.name },
			...model.description === void 0 ? {} : { description: model.description },
			...model.contextWindow === void 0 ? {} : { contextWindow: model.contextWindow },
			...model.maxTokens === void 0 ? {} : { maxTokens: model.maxTokens },
			...model.vision === void 0 ? {} : { vision: model.vision },
			...model.thinking === void 0 ? {} : { thinking: model.thinking },
			...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort },
			...model.api === void 0 ? {} : { api: model.api },
			...model.tools === void 0 ? {} : { tools: model.tools }
		};
	});
}
function validHTTPURL(value, field) {
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error("llm-opencode-go: " + field + " must be an HTTP or HTTPS URL");
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("llm-opencode-go: " + field + " must be an HTTP or HTTPS URL");
	return value.replace(/\/+$/u, "");
}
function resolveAdapterOptions(config) {
	const defaultContextWindow = config.defaultContextWindow ?? DEFAULT_CONTEXT_WINDOW;
	const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
	if (!Number.isSafeInteger(defaultContextWindow) || defaultContextWindow <= 0) throw new Error("llm-opencode-go: defaultContextWindow must be a positive integer");
	if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error("llm-opencode-go: streamIdleTimeoutMs is invalid");
	if (config.maxTokens !== void 0 && (!Number.isSafeInteger(config.maxTokens) || config.maxTokens <= 0)) throw new Error("llm-opencode-go: maxTokens must be a positive integer");
	return {
		apiKeyEnv: credentialRef(config.apiKeyEnv ?? "OPENCODE_API_KEY"),
		baseURL: validHTTPURL(config.baseURL ?? PUBLIC_BASE_URL, "baseURL"),
		models: resolveModels(config.models),
		defaultContextWindow,
		maxTokens: config.maxTokens,
		streamIdleTimeoutMs,
		retryPolicy: resolveRetryPolicy(config.retryPolicy ?? {
			mode: "normal",
			maxRetries: DEFAULT_MAX_RETRIES
		}, "llm-opencode-go: retryPolicy")
	};
}
function discoveryFailure(message, baseURL) {
	return {
		ok: false,
		error: {
			code: "model-discovery-failed",
			message,
			details: {
				settingsNs: OPENCODE_GO_SETTINGS_NAMESPACE,
				...baseURL === void 0 ? {} : { baseURL }
			}
		}
	};
}
function settingsFailure(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
function usageFailure(error) {
	if (error instanceof LlmError && error.code === "OPENCODE_GO_USAGE_UNSUPPORTED") return {
		ok: true,
		value: { status: "unsupported" }
	};
	return settingsFailure(error instanceof LlmError && error.message.length > 0 ? error.message : "OpenCode Go usage read failed");
}
function apply(ctx, config) {
	let current = () => config;
	let lastRaw;
	let lastGood;
	const options = () => {
		const raw = current();
		if (raw === lastRaw && lastGood !== void 0) return lastGood;
		try {
			const next = resolveAdapterOptions(raw);
			lastRaw = raw;
			lastGood = next;
			return next;
		} catch (error) {
			if (lastGood === void 0) throw error;
			lastRaw = raw;
			ctx.logger.error("llm-opencode-go: keeping the last good configuration after an invalid settings section");
			ctx.logger.error(error);
			return lastGood;
		}
	};
	options();
	const resolveApiKey = async (connection) => {
		const ref = connection.apiKeyEnv;
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) {
			const hit = await credentials.resolve(ref);
			if (hit !== void 0) return assertUsableApiKey(hit.value, "llm-opencode-go", ref);
		} else {
			const ambient = launchEnvironmentOf(ctx).get(ref);
			if (ambient !== void 0 && ambient.value.length > 0) return assertUsableApiKey(ambient.value, "llm-opencode-go", ref);
		}
		throw new LlmError("llm-opencode-go: no API key for provider route \"opencode-go\"; store " + ref + " through the credentials service, or export " + ref + " in the launching environment", "MISSING_CREDENTIAL");
	};
	const adapter = new OpenCodeGoAdapter({
		options,
		resolveApiKey,
		resolveAttachments: () => ctx.get("attachments")
	});
	const registration = ctx.llm.registerAdapter([OPENCODE_GO_PROVIDER], adapter);
	let registeredPolicy = options().retryPolicy;
	const ensureRegistrationFacts = () => {
		const policy = options().retryPolicy;
		if (deepEqualJson(policy, registeredPolicy)) return;
		registration.replace([OPENCODE_GO_PROVIDER]);
		registeredPolicy = policy;
	};
	const storedApiKey = async () => {
		const ref = options().apiKeyEnv;
		const credentials = ctx.get("credentials");
		if (credentials !== void 0) return (await credentials.resolve(ref))?.value;
		return launchEnvironmentOf(ctx).get(ref)?.value;
	};
	const credentialStatus = async () => {
		const credentials = ctx.get("credentials");
		if (credentials === void 0) return {
			configured: false,
			writable: false
		};
		const info = await credentials.describe(options().apiKeyEnv);
		return {
			configured: info.configured,
			writable: info.writable
		};
	};
	ctx.llm.registerModelDiscovery(NS, (request) => discoverModels(request, storedApiKey));
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.connection.rpc.handle(OPENCODE_GO_RPC_CHANNEL, async (endpoint, payload, signal) => {
			if (endpoint === "settings/read") {
				const descriptor = ctx.get("settings")?.describe().find((item) => item.ns === NS);
				const settings = decodeOpenCodeGoSettings(descriptor?.value);
				if (descriptor === void 0 || settings === void 0) return settingsFailure("OpenCode Go settings are unavailable");
				return {
					ok: true,
					value: {
						settings,
						revision: descriptor.revision,
						credential: await credentialStatus()
					}
				};
			}
			if (endpoint === "credentials/status") return {
				ok: true,
				value: await credentialStatus()
			};
			if (endpoint === "credentials/set") {
				const request = decodeOpenCodeGoCredentialSetRequest(payload);
				if (request === void 0) return settingsFailure("invalid OpenCode Go credential request");
				const credentials = ctx.get("credentials");
				if (credentials === void 0) return settingsFailure("OpenCode Go credentials are unavailable");
				await credentials.set(options().apiKeyEnv, request.apiKey);
				return {
					ok: true,
					value: await credentialStatus()
				};
			}
			if (endpoint === "models/discover") {
				const request = decodeOpenCodeGoDiscoveryRequest(payload);
				if (request === void 0) return discoveryFailure("invalid OpenCode Go discovery request");
				try {
					return {
						ok: true,
						value: { models: await discoverModels({
							...request.baseURL === void 0 ? {} : { baseURL: request.baseURL },
							signal
						}, storedApiKey) }
					};
				} catch (error) {
					return discoveryFailure(error instanceof LlmError ? error.message : "OpenCode Go model discovery failed", request.baseURL);
				}
			}
			if (endpoint === "settings/save") {
				const request = decodeOpenCodeGoSaveRequest(payload);
				if (request === void 0) return settingsFailure("invalid OpenCode Go settings request");
				const settings = ctx.get("settings");
				if (settings === void 0) return settingsFailure("OpenCode Go settings are unavailable");
				try {
					const before = settings.describe().find((descriptor) => descriptor.ns === NS);
					if (before === void 0) return settingsFailure("OpenCode Go settings are unavailable");
					const currentSettings = decodeOpenCodeGoSettings(before.value);
					if (currentSettings === void 0) return settingsFailure("OpenCode Go settings are invalid");
					const ops = [];
					if (!deepEqualJson(currentSettings.baseURL, request.baseURL)) ops.push({
						op: "set",
						path: ["baseURL"],
						value: request.baseURL
					});
					if (!deepEqualJson(currentSettings.models, request.models)) ops.push({
						op: "set",
						path: ["models"],
						value: request.models
					});
					if (ops.length > 0) await settings.mutate(NS, ops, request.expectedRevision);
					const accepted = settings.describe().find((descriptor) => descriptor.ns === NS);
					const acceptedSettings = decodeOpenCodeGoSettings(accepted?.value);
					if (accepted === void 0 || acceptedSettings === void 0) return settingsFailure("OpenCode Go settings could not be reloaded");
					return {
						ok: true,
						value: {
							settings: acceptedSettings,
							revision: accepted.revision
						}
					};
				} catch (error) {
					return settingsFailure(error instanceof Error && error.message.length > 0 ? error.message : "OpenCode Go settings save failed");
				}
			}
			if (endpoint === "usage/read") {
				const request = decodeOpenCodeGoDiscoveryRequest(payload);
				if (request === void 0) return settingsFailure("invalid OpenCode Go usage request");
				try {
					return {
						ok: true,
						value: {
							status: "ok",
							usage: await readOpenCodeGoUsage({
								...request.baseURL === void 0 ? {} : { baseURL: request.baseURL },
								signal
							}, storedApiKey)
						}
					};
				} catch (error) {
					return usageFailure(error);
				}
			}
			return settingsFailure("unknown OpenCode Go endpoint: " + endpoint);
		}, { authority: config.remoteManagement === true ? "trusted-host" : "loopback" });
	});
	installSettingsSection(ctx, NS, Config, config, {
		setSource: (source) => {
			current = source;
		},
		onChange: ensureRegistrationFacts
	});
}
//#endregion
export { Config, DEFAULT_API_KEY_ENV, DEFAULT_CONTEXT_WINDOW, DEFAULT_STREAM_IDLE_TIMEOUT_MS, DEFAULT_USAGE_REQUEST_TIMEOUT_MS, OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, OPENCODE_GO_DISCOVER_ENDPOINT, OPENCODE_GO_PROVIDER, OPENCODE_GO_PUBLIC_BASE_URL, OPENCODE_GO_RPC_CHANNEL, OPENCODE_GO_SAVE_ENDPOINT, OPENCODE_GO_SETTINGS_NAMESPACE, OPENCODE_GO_SETTINGS_READ_ENDPOINT, OPENCODE_GO_USAGE_ENDPOINT, OPENCODE_GO_USAGE_FAILED, OPENCODE_GO_USAGE_UNSUPPORTED, OpenCodeGoAdapter, PUBLIC_BASE_URL, apply, createOpenCodeGoPiAiProfile, decodeOpenCodeGoCatalogModel, decodeOpenCodeGoCredentialSetRequest, decodeOpenCodeGoDiscoveryRequest, decodeOpenCodeGoDiscoveryResult, decodeOpenCodeGoSaveRequest, decodeOpenCodeGoSaveResult, decodeOpenCodeGoSettings, decodeOpenCodeGoSettingsReadResult, decodeOpenCodeGoUsageReply, discoverModels, enrichModel, familyForModel, inject, knownModel, name, parseOpenCodeGoModels, parseOpenCodeGoUsage, protocolForModel, readOpenCodeGoUsage, resolveAdapterOptions };
