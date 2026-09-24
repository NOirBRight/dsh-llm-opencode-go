import { createRequire } from "node:module";
import z from "@deepseek-ai/schemastery";
import { clientRequestSchema } from "@deepseek-ai/dsh-client-connection";
import { INVALID_CREDENTIAL_CODE, LlmAdapter, LlmError, RetryPolicySchema, assertUsableApiKey, attributionHeaders, normalizeApiKey, resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { deepEqualJson } from "@deepseek-ai/dsh-util-values";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { createProvider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { openAIResponsesApi } from "@earendil-works/pi-ai/api/openai-responses.lazy";
import { anthropicMessagesApi } from "@earendil-works/pi-ai/api/anthropic-messages.lazy";
//#region lib/types/compatibility.js
/**
* Classify one runtime without treating the verified table as an allowlist.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns The fail-open mount decision.
*/
function classifyDshRuntime(version, verified, blocklist = {}) {
	const reason = blocklist[version];
	if (typeof reason === "string" && reason.trim() !== "") return {
		kind: "blocked",
		reason
	};
	return verified.has(version) ? { kind: "verified" } : { kind: "unverified" };
}
/**
* Apply the fail-open decision and emit at most one visible warning.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param version - Resolved DSH runtime version.
* @param verified - Releases with direct compatibility evidence.
* @param blocklist - Versions excluded after reproduced failures.
* @returns Whether the host mount should continue.
*/
function shouldMountDshRuntime(logger, pluginName, version, verified, blocklist = {}) {
	const decision = classifyDshRuntime(version, verified, blocklist);
	if (decision.kind === "blocked") {
		logger.warn(`[${pluginName}] blocked on DSH ${version}: ${decision.reason}; see package.json#dsh.compatibility.blocklist`);
		return false;
	}
	if (decision.kind === "unverified") logger.warn(`[${pluginName}] best-effort on unverified runtime ${version}`);
	return true;
}
function readManifest() {
	try {
		return JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
	} catch {
		return {};
	}
}
function packageVersion(packageName) {
	try {
		const require = createRequire(import.meta.url);
		let directory = dirname(require.resolve(packageName));
		for (;;) {
			try {
				const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
				if (typeof manifest.version === "string" && manifest.version !== "") return manifest.version;
			} catch {}
			const parent = dirname(directory);
			if (parent === directory) return void 0;
			directory = parent;
		}
	} catch {
		return;
	}
}
/**
* Warn once for an unknown runtime while keeping the normal host mount path.
* @param logger - Host logger receiving compatibility warnings.
* @param pluginName - Plugin identifier used in diagnostics.
* @param candidates - DSH peer packages used to resolve the host version.
* @returns Whether the host mount should continue.
*/
function allowDshRuntime(logger, pluginName, candidates) {
	const version = process.env.DSH_VERSION?.trim() || candidates.map(packageVersion).find((value) => value !== void 0) || "unknown";
	const compatibility = readManifest().dsh?.compatibility;
	return shouldMountDshRuntime(logger, pluginName, version, new Set(Object.entries(compatibility?.dshReleases ?? {}).filter(([, status]) => status === "compatible" || status === "verified").map(([release]) => release)), compatibility?.blocklist);
}
//#endregion
//#region lib/types/json-record.js
/** Client-safe JSON object guard shared by Host parsers and browser decoders. */
/** True for a plain object that can be JSON-decoded field-wise. */
function isJsonRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region lib/types/client-contract.js
/** Browser-safe constants and JSON decoders shared by the Host and client plugin faces. */
/** Loader entry id from cordis.patch.yml and key used by the provider directory. */
const OPENCODE_GO_ENTRY_ID = "llm-opencode-go";
/** Provider route owned by the OpenCode Go plugin. */
const OPENCODE_GO_PROVIDER = "opencode-go";
/** Credential reference used when the plugin config omits it. */
const DEFAULT_API_KEY_ENV = "OPENCODE_API_KEY";
/** Public OpenCode Go API base URL. */
const OPENCODE_GO_PUBLIC_BASE_URL = "https://opencode.ai/zen/go/v1";
/** Default context capacity for models without documented or discovered metadata. */
const OPENCODE_GO_DEFAULT_CONTEXT_WINDOW = 262144;
/** Default maximum idle interval while a stream read is outstanding. */
const OPENCODE_GO_DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
/** Exact Fetch route method shared by this Host and client plugin. */
const OPENCODE_GO_RPC_ENDPOINT = "plugin-rpc/opencode-go";
/** Rich model-discovery endpoint inside the authenticated plugin Fetch route. */
const OPENCODE_GO_DISCOVER_ENDPOINT = "models/discover";
/** Value-free credential status endpoint. */
const OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT = "credentials/status";
/** One-way credential write endpoint. */
const OPENCODE_GO_CREDENTIAL_SET_ENDPOINT = "credentials/set";
/** Subscription usage-snapshot endpoint inside the authenticated plugin Fetch route. */
const OPENCODE_GO_USAGE_ENDPOINT = "usage/read";
/** Validate edited settings on the Host before committing Loader ConfigForm changes. */
const OPENCODE_GO_VALIDATE_ENDPOINT = "settings/validate";
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
	const thinkingEfforts = value.thinkingEfforts;
	const tools = value.tools;
	const protocol = value.api;
	if (name !== void 0 && typeof name !== "string") return void 0;
	if (description !== void 0 && typeof description !== "string") return void 0;
	if (!optionalPositiveInteger(contextWindow) || !optionalPositiveInteger(maxTokens)) return void 0;
	if (vision !== void 0 && typeof vision !== "boolean") return void 0;
	if (thinking !== void 0 && typeof thinking !== "boolean") return void 0;
	if (defaultEffort !== void 0 && (typeof defaultEffort !== "string" || defaultEffort.length === 0)) return void 0;
	const efforts = [];
	if (thinkingEfforts !== void 0) {
		if (!Array.isArray(thinkingEfforts)) return void 0;
		for (const item of thinkingEfforts) {
			if (typeof item !== "string" || item.length === 0) return void 0;
			efforts.push(item);
		}
	}
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
		...efforts.length === 0 ? {} : { thinkingEfforts: efforts },
		...protocol === void 0 ? {} : { api: protocol },
		...tools === void 0 ? {} : { tools }
	};
}
/** Only public settings reach the Host validator; credentials use their own write route. */
function decodeOpenCodeGoValidationRequest(value) {
	if (!isJsonRecord(value) || Object.keys(value).some((key) => key !== "baseURL" && key !== "models") || typeof value.baseURL !== "string" || !Array.isArray(value.models)) return void 0;
	const models = value.models.map(decodeOpenCodeGoCatalogModel);
	if (models.some((model) => model === void 0)) return void 0;
	return {
		baseURL: value.baseURL,
		models
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
function decodeOpenCodeGoCredentialSetRequest(value) {
	return isJsonRecord(value) && typeof value.apiKey === "string" && value.apiKey.trim().length > 0 ? { apiKey: value.apiKey } : void 0;
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
		vision: true,
		thinking: true,
		defaultEffort: "max",
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
		defaultEffort: "max",
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
		id: "deepseek-flash",
		name: "DeepSeek V4.1 Flash",
		contextWindow: 1e6,
		maxTokens: 384e3,
		api: "openai-completions",
		vision: true,
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
		defaultEffort: "xhigh",
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
		defaultEffort: "xhigh",
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
		defaultEffort: "xhigh",
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
		defaultEffort: "xhigh",
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
		defaultEffort: "high",
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
		defaultEffort: "high",
		family: "minimax"
	},
	{
		id: "minimax-m2.5",
		name: "MiniMax M2.5",
		contextWindow: 204800,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: false,
		thinking: true,
		defaultEffort: "high",
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
		defaultEffort: "xhigh",
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
		contextWindow: 262144,
		maxTokens: 65536,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "qwen"
	},
	{
		id: "hy4-preview",
		name: "Hy4 preview",
		contextWindow: 1024e3,
		maxTokens: 64e3,
		api: "openai-completions",
		vision: false,
		thinking: true,
		defaultEffort: "high",
		family: "hy3"
	},
	{
		id: "qwen3.8-flash",
		name: "Qwen3.8 Flash",
		contextWindow: 1e6,
		maxTokens: 131072,
		api: "anthropic-messages",
		vision: true,
		thinking: true,
		defaultEffort: "xhigh",
		family: "qwen"
	},
	{
		id: "muse-spark-1.3-contributor",
		name: "Muse Spark 1.3 Contributor",
		contextWindow: 1048576,
		maxTokens: 131072,
		api: "openai-responses",
		vision: true,
		thinking: true,
		defaultEffort: "max",
		family: "muse"
	},
	{
		id: "omen-alpha",
		name: "Omen Alpha",
		contextWindow: 5e5,
		maxTokens: 128e3,
		api: "openai-completions",
		vision: true,
		thinking: true,
		defaultEffort: "high",
		family: "other"
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
*
* @see https://opencode.ai/docs/zh-cn/go/ API 端点 table
*/
function protocolForModel(id) {
	const known = BY_ID.get(id);
	if (known !== void 0) return known.api;
	const key = id.toLowerCase();
	if (key.startsWith("grok-") || key.startsWith("gpt-") || key.startsWith("muse-")) return "openai-responses";
	if (key.startsWith("minimax-") || key.startsWith("qwen")) return "anthropic-messages";
	return "openai-completions";
}
/**
* Chat origin for one protocol. Completions and Responses use the configured
* OpenAI-compatible origin (`https://opencode.ai/zen/go/v1`). Messages use the
* Anthropic SDK origin: that same URL without one trailing `/v1`, because the
* SDK posts `{base}/v1/messages` and the official table lists
* `https://opencode.ai/zen/go/v1/messages`.
*
* @param baseURL Settings origin, usually ending in `/zen/go/v1`.
* @param api Wire protocol for the selected model.
* @returns Origin passed to pi-ai as `model.baseUrl`.
* @see https://opencode.ai/docs/zh-cn/go/
*/
function chatBaseURLForApi(baseURL, api) {
	const base = baseURL.replace(/\/+$/u, "");
	if (api !== "anthropic-messages") return base;
	return base.endsWith("/v1") ? base.slice(0, -3) : base;
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
/** Merge live listing, models.dev, then the local snapshot. Do not invent a window. */
function enrichModel(id, listed, overlay) {
	const known = BY_ID.get(id);
	const contextWindow = listed.contextWindow ?? overlay?.contextWindow ?? known?.contextWindow;
	const maxTokens = listed.maxTokens ?? overlay?.maxTokens ?? known?.maxTokens;
	const name = listed.name ?? overlay?.name ?? known?.name ?? displayName(id);
	const description = listed.description ?? overlay?.description;
	const vision = listed.vision ?? overlay?.vision ?? (known?.vision === true || id.toLowerCase().includes("vision") || id.toLowerCase().includes("omni"));
	const thinking = listed.thinking ?? overlay?.thinking ?? known?.thinking === true;
	const defaultEffort = listed.defaultEffort ?? overlay?.defaultEffort ?? known?.defaultEffort;
	const thinkingEfforts = listed.thinkingEfforts ?? overlay?.thinkingEfforts;
	return {
		id,
		name,
		...description === void 0 || description === name ? {} : { description },
		...contextWindow === void 0 ? {} : { contextWindow },
		...maxTokens === void 0 ? {} : { maxTokens },
		vision,
		thinking,
		...defaultEffort === void 0 || thinking !== true ? {} : { defaultEffort },
		...thinking !== true || thinkingEfforts === void 0 || thinkingEfforts.length === 0 ? {} : { thinkingEfforts },
		api: protocolForModel(id),
		tools: true
	};
}
//#endregion
//#region lib/types/session.js
/** OpenCode Go requires x-opencode-session on every zen/go/v1 request (all models). */
const OPENCODE_GO_SESSION_HEADER = "x-opencode-session";
const FALLBACK_SESSION = "ses_dsh-opencode-go-" + randomUUID();
const store = new AsyncLocalStorage();
function openCodeGoSessionId() {
	return store.getStore() ?? FALLBACK_SESSION;
}
function openCodeGoSessionHeaders(sessionId = openCodeGoSessionId()) {
	return { [OPENCODE_GO_SESSION_HEADER]: sessionId };
}
/** Bind session id for the duration of work so profile header getters see it. */
function runOpenCodeGoSession(sessionId, work) {
	const id = sessionId !== void 0 && sessionId.length > 0 ? sessionId : FALLBACK_SESSION;
	return store.run(id, work);
}
/** Live header bag: PiAiAdapter copies this at stream start, so the getter must read ALS then. */
function openCodeGoProfileHeaders() {
	return Object.defineProperty({}, OPENCODE_GO_SESSION_HEADER, {
		enumerable: true,
		configurable: true,
		get: openCodeGoSessionId
	});
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
const OFF_HIGH = pin({
	off: "none",
	high: "high"
});
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
const LOW_MEDIUM_HIGH_XHIGH = pin({
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh"
});
const LOW_MEDIUM_HIGH_XHIGH_MAX = pin({
	low: "low",
	medium: "medium",
	high: "high",
	xhigh: "xhigh",
	max: "max"
});
const LOW_MEDIUM_XHIGH = pin({
	low: "low",
	medium: "medium",
	xhigh: "xhigh"
});
const LOW_HIGH_MAX = pin({
	low: "low",
	high: "high",
	max: "max"
});
const HIGH_MAX = pin({
	high: "high",
	max: "max"
});
const HIGH_ONLY = pin({ high: "high" });
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
		levels: LOW_MEDIUM_HIGH_XHIGH,
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
		levels: LOW_HIGH_MAX,
		defaultEffort: "max"
	},
	kimi: {
		levels: LOW_HIGH_MAX,
		defaultEffort: "max"
	},
	qwen: {
		levels: OFF_HIGH,
		defaultEffort: "high"
	},
	deepseek: {
		levels: OFF_LOW_HIGH_MAX,
		defaultEffort: "max"
	},
	mimo: {
		levels: LOW_MEDIUM_XHIGH,
		defaultEffort: "xhigh"
	},
	hy3: {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	},
	minimax: {
		levels: HIGH_ONLY,
		defaultEffort: "high"
	},
	longcat: {
		levels: OFF_HIGH,
		defaultEffort: "high"
	}
};
const MODEL_POLICIES = {
	"grok-4.6": {
		levels: LOW_MEDIUM_HIGH_XHIGH,
		defaultEffort: "high"
	},
	"grok-4.5": {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	},
	"hy4-preview": {
		levels: OFF_HIGH,
		defaultEffort: "high"
	},
	"qwen3.8-flash": {
		levels: LOW_MEDIUM_XHIGH,
		defaultEffort: "xhigh"
	},
	"muse-spark-1.3-contributor": {
		levels: pin({
			minimal: "minimal",
			low: "low",
			medium: "medium",
			high: "high",
			xhigh: "xhigh",
			max: "max"
		}),
		defaultEffort: "max"
	},
	"omen-alpha": {
		levels: pin({
			low: "low",
			high: "high"
		}),
		defaultEffort: "high"
	}
};
function classifyPolicy(model) {
	const id = model.toLowerCase();
	const exact = MODEL_POLICIES[id];
	if (exact !== void 0) return exact;
	if (id.startsWith("glm-5.3")) return {
		levels: LOW_HIGH_MAX,
		defaultEffort: "max"
	};
	if (id.startsWith("glm-5.2")) return {
		levels: OFF_HIGH_MAX,
		defaultEffort: "max"
	};
	if (id.startsWith("glm-5.1")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id === "glm-5" || id.startsWith("glm-5-")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id.startsWith("kimi-k3")) return {
		levels: LOW_HIGH_MAX,
		defaultEffort: "max"
	};
	if (id.startsWith("kimi-k2.7")) return {
		levels: HIGH_ONLY,
		defaultEffort: "high"
	};
	if (id.startsWith("kimi-k2.6")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id.startsWith("kimi-k2.5")) return {
		levels: LOW_HIGH_MAX,
		defaultEffort: "max"
	};
	if (id.startsWith("qwen3.8")) return {
		levels: LOW_MEDIUM_XHIGH,
		defaultEffort: "xhigh"
	};
	if (id.startsWith("qwen3.7") || id.startsWith("qwen3.6") || id.startsWith("qwen3.5")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id.startsWith("mimo-")) return {
		levels: LOW_MEDIUM_XHIGH,
		defaultEffort: "xhigh"
	};
	if (id.startsWith("hy4")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id === "hy3" || id.startsWith("hy3-")) return {
		levels: LOW_MEDIUM_HIGH,
		defaultEffort: "high"
	};
	if (id.startsWith("minimax-m3")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id.startsWith("minimax-")) return {
		levels: HIGH_ONLY,
		defaultEffort: "high"
	};
	if (id.startsWith("longcat-")) return {
		levels: OFF_HIGH,
		defaultEffort: "high"
	};
	if (id.includes("vision") && id.startsWith("deepseek-v4-flash")) return {
		levels: HIGH_MAX,
		defaultEffort: "max"
	};
	if (id.startsWith("deepseek-")) return {
		levels: OFF_LOW_HIGH_MAX,
		defaultEffort: "max"
	};
	return FAMILIES[familyForModel(model)] ?? {
		levels: GENERIC,
		defaultEffort: "medium"
	};
}
function policyFor(model) {
	return classifyPolicy(model);
}
/** Map a models.dev / wire effort token onto the plugin's level ids. */
function canonOpenCodeGoEffort(value) {
	const key = value === "none" ? "off" : value;
	return OPENCODE_GO_EFFORT_ORDER.includes(key) ? key : void 0;
}
function levelsFromRow(model) {
	const listed = model.thinkingEfforts;
	if (listed === void 0 || listed.length === 0) return policyFor(model.id).levels;
	const supported = {};
	for (const raw of listed) {
		const level = canonOpenCodeGoEffort(raw);
		if (level === void 0) continue;
		supported[level] = level === "off" ? "none" : level;
	}
	if (OPENCODE_GO_EFFORT_ORDER.every((level) => supported[level] === void 0)) return policyFor(model.id).levels;
	return pin(supported);
}
/** Supported thinking levels for one catalog row, in canonical order. */
function openCodeGoSupportedEfforts(model) {
	if (model.thinking !== true) return [];
	const levels = levelsFromRow(model);
	return OPENCODE_GO_EFFORT_ORDER.filter((level) => levels[level] !== null && levels[level] !== void 0);
}
/** Thinking-level map for one catalog row, or undefined when thinking is off. */
function openCodeGoThinkingLevelMap(model) {
	if (model.thinking !== true) return void 0;
	return levelsFromRow(model);
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
//#region lib/types/models-dev.js
/** Live models.dev overlay for OpenCode Go ids that GET /models does not describe. */
/** Public models.dev catalog used to fill OpenCode Go capacities. */
const MODELS_DEV_URL = "https://models.dev/api.json";
const MODELS_DEV_MAX_BYTES = 8388608;
const MODELS_DEV_TIMEOUT_MS = 15e3;
const REFRESH_AFTER_MS = 864e5;
let cache;
let inflight;
function diskCachePath() {
	if (process.env.VITEST !== void 0) return void 0;
	return join(tmpdir(), "dsh-llm-opencode-go-models-dev.json");
}
function hydrateFromDisk() {
	if (cache !== void 0) return;
	const path = diskCachePath();
	if (path === void 0) return;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		if (!isJsonRecord(parsed) || typeof parsed.at !== "number" || !Array.isArray(parsed.models)) return;
		const overlay = /* @__PURE__ */ new Map();
		for (const row of parsed.models) {
			const model = decodeOpenCodeGoCatalogModel(row);
			if (model === void 0) continue;
			overlay.set(model.id, model);
		}
		cache = {
			at: parsed.at,
			overlay
		};
	} catch {}
}
function writeDisk(at, overlay) {
	const path = diskCachePath();
	if (path === void 0) return;
	try {
		const tmp = path + ".tmp";
		writeFileSync(tmp, JSON.stringify({
			at,
			models: [...overlay.values()]
		}));
		renameSync(tmp, path);
	} catch {}
}
/** Return the cached overlay without fetching. */
function peekOpenCodeGoModelsDev() {
	hydrateFromDisk();
	return cache?.overlay;
}
function positiveInteger$1(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : void 0;
}
function nonEmpty$1(value) {
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
function effortValues(value) {
	if (!isJsonRecord(value)) return [];
	const options = value.reasoning_options;
	if (!Array.isArray(options)) return [];
	const found = [];
	for (const option of options) {
		if (!isJsonRecord(option) || !Array.isArray(option.values)) continue;
		for (const item of option.values) {
			if (typeof item !== "string") continue;
			const effort = canonOpenCodeGoEffort(item);
			if (effort !== void 0 && !found.includes(effort)) found.push(effort);
		}
	}
	return found;
}
/** Vision follows input modalities, not the sloppy models.dev attachment flag. */
function visionOf(value) {
	const modalities = isJsonRecord(value.modalities) ? value.modalities.input : void 0;
	if (!Array.isArray(modalities)) return void 0;
	return modalities.includes("image");
}
/** Parse one models.dev OpenCode Go row into catalog fields. */
function parseOpenCodeGoModelsDevRow(id, value) {
	if (!isJsonRecord(value)) return void 0;
	const limit = isJsonRecord(value.limit) ? value.limit : void 0;
	const contextWindow = limit === void 0 ? void 0 : positiveInteger$1(limit.context);
	const maxTokens = limit === void 0 ? void 0 : positiveInteger$1(limit.output);
	const name = nonEmpty$1(value.name);
	const description = nonEmpty$1(value.description);
	const efforts = effortValues(value);
	const thinking = typeof value.reasoning === "boolean" ? value.reasoning : void 0;
	const vision = visionOf(value);
	const defaultEffort = thinking === true ? efforts.includes("high") ? "high" : efforts[efforts.length - 1] : void 0;
	return {
		id,
		...name === void 0 ? {} : { name },
		...description === void 0 ? {} : { description },
		...contextWindow === void 0 ? {} : { contextWindow },
		...maxTokens === void 0 ? {} : { maxTokens },
		...vision === void 0 ? {} : { vision },
		...thinking === void 0 ? {} : { thinking },
		...defaultEffort === void 0 ? {} : { defaultEffort },
		...thinking === true && efforts.length > 0 ? { thinkingEfforts: efforts } : {}
	};
}
/** Parse the opencode-go.models object out of a models.dev API document. */
function parseOpenCodeGoModelsDev(value) {
	const provider = isJsonRecord(value) ? value["opencode-go"] : void 0;
	const models = isJsonRecord(provider) ? provider.models : void 0;
	if (!isJsonRecord(models)) return /* @__PURE__ */ new Map();
	const overlay = /* @__PURE__ */ new Map();
	for (const [id, row] of Object.entries(models)) {
		if (id.length === 0) continue;
		const parsed = parseOpenCodeGoModelsDevRow(id, row);
		if (parsed !== void 0) overlay.set(id, parsed);
	}
	return overlay;
}
async function fetchAndStore(fetchImpl, signal) {
	const timeout = AbortSignal.timeout(MODELS_DEV_TIMEOUT_MS);
	const requestSignal = signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
	try {
		const response = await fetchImpl(MODELS_DEV_URL, {
			method: "GET",
			headers: { accept: "application/json" },
			redirect: "error",
			signal: requestSignal
		});
		if (!response.ok) {
			await response.body?.cancel();
			return cache?.overlay ?? /* @__PURE__ */ new Map();
		}
		const overlay = parseOpenCodeGoModelsDev(JSON.parse(await readBoundedText(response, MODELS_DEV_MAX_BYTES, MODELS_DEV_URL, "DISCOVERY_FAILED", requestSignal)));
		const at = Date.now();
		cache = {
			at,
			overlay
		};
		writeDisk(at, overlay);
		return overlay;
	} catch {
		return cache?.overlay ?? /* @__PURE__ */ new Map();
	}
}
/** Fetch models.dev, returning an empty overlay when the document is unavailable. */
async function loadOpenCodeGoModelsDev(fetchImpl = fetch, signal, options) {
	hydrateFromDisk();
	const now = Date.now();
	const force = options?.force === true;
	if (!force && cache !== void 0 && now - cache.at < REFRESH_AFTER_MS) return cache.overlay;
	if (!force && inflight !== void 0) return inflight;
	inflight = fetchAndStore(fetchImpl, signal).finally(() => {
		inflight = void 0;
	});
	if (!force && cache !== void 0) return cache.overlay;
	return await inflight;
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
function parseOpenCodeGoModels(value, overlay = /* @__PURE__ */ new Map()) {
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
		}, overlay.get(id)));
	}
	return models;
}
function listingURL(baseURL) {
	return baseURL.replace(/\/+$/u, "") + "/models";
}
/** Prefer a warm cache; otherwise wait briefly while models.dev fills in the background. */
async function overlayForListing(fetchImpl) {
	const cached = peekOpenCodeGoModelsDev();
	const pending = loadOpenCodeGoModelsDev(fetchImpl);
	if (cached !== void 0) return cached;
	const budget = AbortSignal.timeout(800);
	return await Promise.race([pending, new Promise((resolve) => {
		budget.addEventListener("abort", () => {
			resolve(peekOpenCodeGoModelsDev() ?? /* @__PURE__ */ new Map());
		}, { once: true });
	})]);
}
/** Fetch the current public model catalog. */
async function discoverModels(request, storedApiKey, fetchImpl = fetch, signal) {
	const baseURL = (request.baseURL ?? PUBLIC_BASE_URL).replace(/\/+$/u, "");
	const supplied = request.apiKey ?? await storedApiKey?.();
	const apiKey = supplied === void 0 || supplied.trim().length === 0 ? void 0 : requireUsableApiKey(supplied, "this provider's API key is blank; enter it in Plugin configuration, or clear it to probe unauthenticated");
	const url = listingURL(baseURL);
	const timeout = AbortSignal.timeout(DISCOVERY_TIMEOUT_MS);
	const requestSignal = signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
	const overlayPromise = overlayForListing(fetchImpl);
	let response;
	try {
		response = await fetchImpl(url, {
			method: "GET",
			headers: {
				accept: "application/json",
				...apiKey === void 0 ? {} : { authorization: "Bearer " + apiKey },
				...attributionHeaders(),
				...openCodeGoSessionHeaders("ses_dsh-opencode-go-discovery")
			},
			redirect: "error",
			signal: requestSignal
		});
	} catch (error) {
		if (signal?.aborted) throw new LlmError("OpenCode Go model discovery aborted", "ABORTED", { cause: error });
		throw new LlmError("Could not reach OpenCode Go model catalog", "DISCOVERY_FAILED", { cause: error });
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new LlmError(url + " answered HTTP " + String(response.status), response.status === 401 || response.status === 403 ? INVALID_CREDENTIAL_CODE : "DISCOVERY_FAILED", { status: response.status });
	}
	let body;
	try {
		body = JSON.parse(await readBoundedText(response, MAX_DISCOVERY_BYTES, url, "DISCOVERY_FAILED", requestSignal));
	} catch (error) {
		if (error instanceof LlmError) throw error;
		if (signal?.aborted) throw new LlmError("OpenCode Go model discovery aborted", "ABORTED", { cause: error });
		throw new LlmError("OpenCode Go model catalog did not return JSON", "DISCOVERY_FAILED", { cause: error });
	}
	let overlay = await overlayPromise;
	let models = parseOpenCodeGoModels(body, overlay);
	if (models.some((model) => !overlay.has(model.id) && knownModel(model.id) === void 0)) {
		overlay = await loadOpenCodeGoModelsDev(fetchImpl, requestSignal, { force: true });
		models = parseOpenCodeGoModels(body, overlay);
	}
	return models;
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
	const models = connection.models.map((model) => {
		const api = model.api ?? protocolForModel(model.id);
		return toPiAiModel(model, connection, chatBaseURLForApi(baseURL, api));
	});
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
		headers: openCodeGoProfileHeaders(),
		piProvider,
		configuredMaxTokens,
		modelErrors: /* @__PURE__ */ new Map()
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
const SANDBOX_MODE_RANK = {
	"read-only": 0,
	"workspace-write": 1,
	"danger-full-access": 2
};
/**
* Remove sandbox escalation choices that cannot be strictly wider than the
* current DSH policy. Core still validates every retained request; this only
* prevents the model from selecting an impossible optional enum value.
* Scans both options.system and options.messages context-injection text.
*/
function narrowOpenCodeGoEscalationSchemas(options) {
	const mode = sandboxModeOf(options);
	const currentRank = mode === void 0 ? void 0 : SANDBOX_MODE_RANK[mode];
	if (currentRank === void 0 || options.tools === void 0) return options;
	let changed = false;
	const tools = options.tools.map((tool) => {
		const parameters = tool.parameters;
		const properties = isRecord(parameters.properties) ? parameters.properties : void 0;
		const permission = properties === void 0 || !isRecord(properties.sandbox_permissions) ? void 0 : properties.sandbox_permissions;
		if (permission === void 0 || !Array.isArray(permission.enum)) return tool;
		const wider = permission.enum.filter((candidate) => {
			return typeof candidate === "string" && (SANDBOX_MODE_RANK[candidate] ?? -1) > currentRank;
		});
		if (wider.length === permission.enum.length) return tool;
		changed = true;
		const nextProperties = { ...properties };
		if (wider.length === 0) {
			delete nextProperties.sandbox_permissions;
			delete nextProperties.justification;
		} else nextProperties.sandbox_permissions = {
			...permission,
			enum: wider
		};
		const required = Array.isArray(parameters.required) ? parameters.required.filter((name) => name !== "sandbox_permissions" && name !== "justification") : void 0;
		return {
			...tool,
			parameters: {
				...parameters,
				properties: nextProperties,
				...required === void 0 ? {} : { required }
			}
		};
	});
	return changed ? {
		...options,
		tools
	} : options;
}
function sandboxModeOf(options) {
	for (let index = options.messages.length - 1; index >= 0; index -= 1) {
		const message = options.messages[index];
		if (!isRecord(message)) continue;
		const found = sandboxModeIn(message.content);
		if (found !== void 0) return found;
	}
	return sandboxModeIn(options.system);
}
function sandboxModeIn(value) {
	if (typeof value === "string") return /Current DSH file policy:\s*(read-only|workspace-write|danger-full-access)\./u.exec(value)?.[1];
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = sandboxModeIn(item);
			if (found !== void 0) return found;
		}
		return;
	}
	if (!isRecord(value)) return void 0;
	return sandboxModeIn(value.text) ?? sandboxModeIn(value.content);
}
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
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
	* OpenCode Go does not publish provider-owned image-request pricing.
	* @param _provider - provider route.
	* @param _model - exact model id.
	* @returns undefined so the Host uses its neutral image estimate.
	*/
	imageRequestPricing(_provider, _model) {}
	listModels(provider) {
		return this.current().listModels(provider);
	}
	async resolveModel(provider, model, signal) {
		return applyOpenCodeGoReasoningMetadata(await this.current().resolveModel(provider, model, signal), model, this.config.options().models.find((entry) => entry.id === model)?.defaultEffort);
	}
	async *stream(options) {
		yield* streamWithOpenCodeGoSession(options, (opts) => this.current().stream(opts));
	}
	async prepareCall(provider, model, signal) {
		const inner = await this.current().prepareCall(provider, model, signal);
		const catalog = this.config.options().models.find((entry) => entry.id === model);
		return {
			model: applyOpenCodeGoReasoningMetadata(inner.model, model, catalog?.defaultEffort),
			stream: (options) => streamWithOpenCodeGoSession(options, (opts) => inner.stream(opts))
		};
	}
};
async function* streamWithOpenCodeGoSession(options, stream) {
	const sessionId = options.sessionId === void 0 ? void 0 : String(options.sessionId);
	const iterator = stream(narrowOpenCodeGoEscalationSchemas(options))[Symbol.asyncIterator]();
	for (;;) {
		const step = await runOpenCodeGoSession(sessionId, () => iterator.next());
		if (step.done) return;
		yield classifyOpenCodeGoTransientError(step.value);
	}
}
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
				...attributionHeaders(),
				...openCodeGoSessionHeaders("ses_dsh-opencode-go-usage")
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
* Register the OpenCode Go route with chat delegated to pi-ai. Completions,
* Responses, and Messages are selected per model. Discovery and usage use the
* authenticated Host plugin Fetch route; keys never cross the browser.
*/
const name = "llm-opencode-go";
const inject = ["llm", "webServer"];
const DEFAULT_MAX_RETRIES = 3;
const ENTRY_ID = OPENCODE_GO_ENTRY_ID;
const catalogModel = z.object({
	id: z.string().required(),
	name: z.string(),
	description: z.string(),
	contextWindow: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
	maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
	vision: z.boolean(),
	thinking: z.boolean(),
	defaultEffort: z.string().min(1),
	thinkingEfforts: z.array(z.string().min(1)),
	api: z.union([
		"openai-completions",
		"openai-responses",
		"anthropic-messages"
	]),
	tools: z.boolean()
});
const Config = z.object({
	apiKeyEnv: z.string().pattern(/^[A-Za-z_][A-Za-z0-9_]*$/u).role("credential-ref").default(DEFAULT_API_KEY_ENV),
	baseURL: z.string().default(PUBLIC_BASE_URL).volatile(),
	models: z.array(catalogModel).default([]).volatile(),
	defaultContextWindow: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER).default(DEFAULT_CONTEXT_WINDOW),
	streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
	retryPolicy: RetryPolicySchema
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
			...model.thinkingEfforts === void 0 ? {} : { thinkingEfforts: [...model.thinkingEfforts] },
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
				settingsNs: ENTRY_ID,
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
function responseForRpc(rpcId, result) {
	if (!result.ok) return Response.json({
		type: "server-response",
		rpcId,
		result
	});
	const { attachments, ...success } = result;
	const body = {
		type: "server-response",
		rpcId,
		result: success
	};
	if (attachments === void 0 || attachments.length === 0) return Response.json(body);
	const parts = new FormData();
	const attachmentMetadata = attachments.map((attachment, index) => {
		const part = "bytes-" + index;
		parts.set(part, new Blob([new Uint8Array(attachment.bytes)]));
		return {
			path: [...attachment.path],
			codec: "bytes",
			part
		};
	});
	parts.set("metadata", JSON.stringify({
		...body,
		attachments: attachmentMetadata
	}));
	return new Response(parts);
}
function apply(ctx, config) {
	if (!allowDshRuntime(ctx.logger, "dsh-llm-opencode-go", ["@deepseek-ai/dsh-llm"])) return;
	if (Object.hasOwn(config, "remoteManagement")) throw new Error("llm-opencode-go: remoteManagement is unsupported by the alpha2 Host Fetch route; remove it from the plugin config");
	let lastBaseURL;
	let lastModels;
	let lastGood;
	const options = () => {
		const baseURL = config.baseURL.get();
		const models = config.models.get();
		if (lastGood !== void 0 && baseURL === lastBaseURL && models === lastModels) return lastGood;
		const next = resolveAdapterOptions({
			...config,
			baseURL,
			models
		});
		lastBaseURL = baseURL;
		lastModels = models;
		lastGood = next;
		return next;
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
	ctx.llm.registerModelDiscovery(OPENCODE_GO_ENTRY_ID, (request, signal) => discoverModels(request, storedApiKey, fetch, signal));
	ctx.effect(() => {
		return ctx.inject(["connection", "webServer"], (connectionCtx) => {
			const handler = async (endpoint, payload, signal) => {
				if (endpoint === "settings/validate") {
					const request = decodeOpenCodeGoValidationRequest(payload);
					if (request === void 0) return settingsFailure("invalid OpenCode Go settings request");
					try {
						resolveAdapterOptions({
							...config,
							...request
						});
						return {
							ok: true,
							value: {}
						};
					} catch (error) {
						return settingsFailure(error instanceof Error ? error.message : "OpenCode Go settings are invalid");
					}
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
							value: { models: await discoverModels({ ...request.baseURL === void 0 ? {} : { baseURL: request.baseURL } }, storedApiKey, fetch, signal) }
						};
					} catch (error) {
						return discoveryFailure(error instanceof LlmError ? error.message : "OpenCode Go model discovery failed", request.baseURL);
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
			};
			connectionCtx.effect(() => connectionCtx.connection.fetch.register({
				path: "/api/plugin-rpc/opencode-go",
				methods: ["POST"],
				requestBody: "buffered",
				fetch: async (request) => {
					if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return new Response("content type must be application/json", { status: 415 });
					let body;
					try {
						body = await request.json();
					} catch {
						return new Response("body is not JSON", { status: 400 });
					}
					const parsed = clientRequestSchema.safeParse(body);
					if (!parsed.success || parsed.data.method !== "plugin-rpc/opencode-go") return new Response("invalid OpenCode Go plugin RPC request", { status: 400 });
					const wrapped = parsed.data.payload;
					if (typeof wrapped !== "object" || wrapped === null || Array.isArray(wrapped)) return new Response("invalid OpenCode Go plugin RPC payload", { status: 400 });
					if (!("endpoint" in wrapped) || typeof wrapped.endpoint !== "string") return new Response("invalid OpenCode Go plugin RPC payload", { status: 400 });
					const endpoint = wrapped.endpoint;
					const payload = "payload" in wrapped ? wrapped.payload : void 0;
					try {
						const result = await handler(endpoint, payload, request.signal, connectionCtx.connection.operator);
						return responseForRpc(parsed.data.rpcId, result);
					} catch {
						return new Response("OpenCode Go plugin RPC handler failure", { status: 500 });
					}
				}
			}), "llm-opencode-go: authenticated plugin RPC route");
		}).dispose;
	}, "llm-opencode-go: connection Fetch injection");
	ctx.on("loader/volatile-update", (paths) => {
		if (paths.some((path) => path[0] === "baseURL" || path[0] === "models")) ensureRegistrationFacts();
	});
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber), "llm-opencode-go: disable generated settings page");
	});
}
//#endregion
export { Config, DEFAULT_API_KEY_ENV, DEFAULT_CONTEXT_WINDOW, DEFAULT_STREAM_IDLE_TIMEOUT_MS, DEFAULT_USAGE_REQUEST_TIMEOUT_MS, OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, OPENCODE_GO_DISCOVER_ENDPOINT, OPENCODE_GO_ENTRY_ID, OPENCODE_GO_PROVIDER, OPENCODE_GO_PUBLIC_BASE_URL, OPENCODE_GO_RPC_ENDPOINT, OPENCODE_GO_USAGE_ENDPOINT, OPENCODE_GO_USAGE_FAILED, OPENCODE_GO_USAGE_UNSUPPORTED, OPENCODE_GO_VALIDATE_ENDPOINT, OpenCodeGoAdapter, PUBLIC_BASE_URL, apply, chatBaseURLForApi, createOpenCodeGoPiAiProfile, decodeOpenCodeGoCatalogModel, decodeOpenCodeGoCredentialSetRequest, decodeOpenCodeGoDiscoveryRequest, decodeOpenCodeGoDiscoveryResult, decodeOpenCodeGoUsageReply, decodeOpenCodeGoValidationRequest, discoverModels, enrichModel, familyForModel, inject, knownModel, name, parseOpenCodeGoModels, parseOpenCodeGoUsage, protocolForModel, readOpenCodeGoUsage, resolveAdapterOptions };
