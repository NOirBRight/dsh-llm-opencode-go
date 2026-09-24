window.__ModuleLoader__.load({
	id: "dsh-llm-opencode-go",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react_dom = require("react-dom");
		//#region src/json-record.ts
		/** Client-safe JSON object guard shared by Host parsers and browser decoders. */
		/** True for a plain object that can be JSON-decoded field-wise. */
		function isJsonRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		//#endregion
		//#region src/client-contract.ts
		/** Browser-safe constants and JSON decoders shared by the Host and client plugin faces. */
		/** Loader entry id from cordis.patch.yml and key used by the provider directory. */
		const OPENCODE_GO_ENTRY_ID = "llm-opencode-go";
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
		//#region src/client/BrandMark.tsx
		function BrandMark() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 18,
				height: 18,
				viewBox: "128 96 256 320",
				"aria-hidden": "true",
				style: { flex: "none" },
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					opacity: .35,
					d: "M320 224V352H192V224H320Z"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					fillRule: "evenodd",
					d: "M384 416H128V96H384V416ZM320 160H192V352H320V160Z"
				})]
			});
		}
		//#endregion
		//#region src/client/model-catalog-ui.tsx
		const inputStyle = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 36,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			padding: "7px 10px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit"
		};
		const rowInputStyle = {
			...inputStyle,
			minHeight: 32,
			padding: "4px 10px"
		};
		const modelContentStyle = {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto",
			alignItems: "center",
			gap: 6,
			padding: "6px 8px"
		};
		//#endregion
		//#region src/catalog.ts
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
		//#endregion
		//#region src/reasoning.ts
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
		/** Plugin-owned default effort for a known family. */
		function openCodeGoDefaultEffort(model) {
			return policyFor(model).defaultEffort;
		}
		/** Display name for one effort id (e.g. "high" -> "High", "xhigh" -> "Xhigh"). */
		function formatEffortName(level) {
			return level.charAt(0).toUpperCase() + level.slice(1);
		}
		/** Effective default for a draft row: explicit if valid, else family default, else first supported. */
		function resolveEffectiveDefaultEffort(model) {
			if (model.thinking !== true) return void 0;
			const explicit = model.defaultEffort;
			if (explicit !== void 0) {
				if (openCodeGoSupportedEfforts(model).includes(explicit)) return explicit;
			}
			return openCodeGoDefaultEffort(model.id) ?? openCodeGoSupportedEfforts(model)[0];
		}
		/** Whether an explicit effort is valid for the model's family. */
		function isValidEffortForModel(model, effort) {
			if (model.thinking !== true) return false;
			return openCodeGoSupportedEfforts(model).includes(effort);
		}
		//#endregion
		//#region src/client/approved-a-header.tsx
		function normalizeQuotaRemaining(input) {
			const percent = input.remainingPercent;
			if (percent !== void 0) return Number.isFinite(percent) && percent >= 0 && percent <= 100 ? percent : void 0;
			const fraction = input.remainingFraction;
			if (fraction !== void 0) return Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction * 100 : void 0;
		}
		function formatQuotaDetail(detail) {
			return detail;
		}
		const meterWrapStyle = {
			display: "flex",
			flexDirection: "column",
			justifyContent: "center",
			gap: 5,
			minWidth: 0,
			minHeight: 50
		};
		const meterTopStyle = {
			display: "flex",
			alignItems: "baseline",
			justifyContent: "space-between",
			gap: 8
		};
		const meterLabelStyle = {
			minWidth: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		const meterValueStyle = {
			flex: "none",
			fontVariantNumeric: "tabular-nums",
			fontWeight: 500,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-primary)"
		};
		const meterTrackStyle = {
			display: "block",
			width: "100%",
			height: 6,
			overflow: "hidden",
			border: 0,
			borderRadius: 2,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)",
			position: "relative"
		};
		const meterFillBase = {
			display: "block",
			height: "100%",
			borderRadius: 2,
			position: "relative",
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 55%, var(--dsw-alias-label-secondary))"
		};
		const meterWarnFill = { background: "var(--dsw-alias-state-warn-primary)" };
		const meterKnobStyle = {
			position: "absolute",
			right: 0,
			top: 0,
			bottom: 0,
			width: 2,
			background: "var(--dsw-alias-label-primary)"
		};
		const meterSegmentsStyle = {
			position: "absolute",
			inset: 0,
			pointerEvents: "none",
			background: "repeating-linear-gradient(to right, transparent 0, transparent calc(10% - 1px), var(--dsw-alias-bg-layer-1) calc(10% - 1px), var(--dsw-alias-bg-layer-1) 10%)"
		};
		const meterDetailStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 11,
			lineHeight: "16px",
			whiteSpace: "nowrap",
			overflow: "hidden",
			textOverflow: "ellipsis"
		};
		const meterMissingStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12,
			lineHeight: "18px"
		};
		function ProviderQuotaMeter(props) {
			const remaining = normalizeQuotaRemaining(props);
			const label = props.label ?? "Quota";
			if (remaining === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"data-provider-quota-missing": "",
				style: meterMissingStyle,
				children: props.emptyLabel ?? "—"
			});
			const warn = remaining < 20;
			const text = String(remaining);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-quota": "",
				style: meterWrapStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: meterTopStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: meterLabelStyle,
							children: label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: meterValueStyle,
							children: [text, "%"]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						"data-provider-quota-meter": "",
						role: "meter",
						"aria-label": label,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": remaining,
						style: meterTrackStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								...meterFillBase,
								...warn ? meterWarnFill : {},
								width: text + "%"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: meterKnobStyle })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"aria-hidden": "true",
							style: meterSegmentsStyle
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: meterDetailStyle,
						children: props.detail === void 0 ? "\xA0" : formatQuotaDetail(props.detail)
					})
				]
			});
		}
		function ProviderRoleBadge(props) {
			const agent = (props.role ?? "llm") === "agent";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-role-badge": agent ? "agent" : "llm",
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 4,
					whiteSpace: "nowrap",
					fontSize: 10,
					fontWeight: 500,
					lineHeight: "16px",
					padding: "0 5px",
					borderRadius: 3,
					border: "1px solid " + (agent ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-border-l2)"),
					color: agent ? "var(--dsw-alias-bg-layer-1)" : "var(--dsw-alias-label-secondary)",
					background: agent ? "var(--dsw-alias-label-primary)" : "transparent"
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					"aria-hidden": "true",
					width: 12,
					height: 12,
					children: agent ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1.5",
						y: "2",
						width: "13",
						height: "12",
						rx: "2"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m4 5 3 3-3 3m5 0h3" })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "2",
						y: "2",
						width: "12",
						height: "9",
						rx: "3"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m5 11-1 3 5-3M5 6h6" })] })
				}), agent ? "Agent" : "LLM"]
			});
		}
		const PROVIDER_UI_CSS = [
			"[data-provider-card]{box-sizing:border-box;width:100%;min-width:0;list-style:none;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible}",
			"[data-provider-card-header]{box-sizing:border-box;width:100%;min-height:76px!important;display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;padding:12px 14px!important;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}",
			"[data-provider-body][hidden]{display:none!important}",
			"[data-provider-role-badge] svg{width:12px;height:12px}",
			"[data-provider-card-header]:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)}",
			"[data-provider-body]{display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}",
			"[data-provider-quota-mini]{display:block}",
			"[data-providers-list]{display:flex;flex-direction:column}",
			"[data-providers-list] [data-sortable-row]+[data-sortable-row]{border-top:1px solid var(--dsw-alias-border-l2)}",
			"[data-providers-section]{container-type:inline-size}",
			"@media (max-width:680px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px;height:11px}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}}",
			"@container (max-width:540px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px;height:11px}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}}"
		].join("\n");
		function ensureProviderUiCss() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-provider-ui") !== null) return;
			const style = document.createElement("style");
			style.id = "dsh-provider-ui";
			style.textContent = PROVIDER_UI_CSS;
			document.head.appendChild(style);
		}
		function ProviderCardHeader(props) {
			ensureProviderUiCss();
			const quota = props.quota;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				"data-provider-header-main": "",
				style: {
					minHeight: 56,
					display: "flex",
					alignItems: "center",
					gap: 14,
					minWidth: 0,
					flex: 1
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						"data-provider-header-identity": "",
						style: {
							display: "flex",
							alignItems: "center",
							gap: 12,
							minWidth: 190,
							flex: "1 1 190px",
							overflow: "hidden"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"data-provider-header-mark": "",
							style: {
								width: 28,
								height: 28,
								flex: "none",
								display: "grid",
								placeItems: "center",
								overflow: "visible"
							},
							children: props.mark
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: {
								display: "flex",
								flexDirection: "column",
								minWidth: 0,
								flex: 1
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								style: {
									display: "inline-flex",
									alignItems: "center",
									gap: 8,
									fontSize: 14,
									fontWeight: 600,
									lineHeight: "20px",
									whiteSpace: "nowrap"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: props.title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderRoleBadge, { ...props.role === void 0 ? {} : { role: props.role } })]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"data-provider-header-summary": "",
								style: {
									fontSize: 11,
									lineHeight: "16px",
									color: "var(--dsw-alias-label-tertiary)",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis"
								},
								children: props.summary
							})]
						})]
					}),
					quota === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"data-provider-quota-mini": "",
						style: {
							flex: "1 1 210px",
							maxWidth: 260,
							minWidth: 210
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderQuotaMeter, { ...quota })
					}),
					props.status === void 0 || props.status.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						"data-provider-header-status": "",
						style: {
							width: 64,
							flex: "none",
							textAlign: "right",
							fontSize: 11,
							lineHeight: "16px",
							color: "var(--dsw-alias-label-tertiary)",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis"
						},
						children: props.status
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						"data-provider-header-side": "",
						style: {
							display: "inline-flex",
							alignItems: "center",
							gap: 10,
							flex: "none"
						},
						children: [props.unsaved === true && props.unsavedLabel !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: {
								fontSize: 12,
								color: "var(--dsw-alias-label-tertiary)"
							},
							children: props.unsavedLabel
						}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"data-provider-header-chevron": "",
							"aria-hidden": "true",
							style: {
								width: 15,
								fontSize: 20,
								lineHeight: 1,
								textAlign: "center",
								color: "var(--dsw-alias-label-tertiary)",
								transform: props.open ? "rotate(180deg)" : "none"
							},
							children: "⌄"
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/provider-chrome.tsx
		const REFRESH_PATH = "M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z";
		function ensureMotionStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById("dsh-provider-motion") !== null) return;
			const style = document.createElement("style");
			style.id = "dsh-provider-motion";
			style.textContent = ["@keyframes dsh-provider-spin{to{transform:rotate(360deg)}}", "@keyframes dsh-provider-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}"].join("");
			document.head.appendChild(style);
		}
		const iconButtonStyle$1 = {
			boxSizing: "border-box",
			width: 28,
			height: 28,
			padding: 0,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 999,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			cursor: "pointer",
			flex: "none"
		};
		const trackStyle = {
			boxSizing: "border-box",
			height: 14,
			overflow: "hidden",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)"
		};
		const shimmerStyle = {
			display: "block",
			width: "100%",
			height: "100%",
			background: "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, transparent 100%)",
			backgroundSize: "200% 100%",
			animation: "dsh-provider-shimmer 1.25s ease-in-out infinite"
		};
		const chipStyle = {
			display: "inline-block",
			height: 12,
			borderRadius: 4,
			background: "linear-gradient(90deg, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 0%, color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent) 50%, color-mix(in srgb, var(--dsw-alias-label-primary) 10%, transparent) 100%)",
			backgroundSize: "200% 100%",
			animation: "dsh-provider-shimmer 1.25s ease-in-out infinite"
		};
		/** Official `ic_ds_refresh_outline_14` glyph; spins while refreshing. */
		function RefreshIcon(props) {
			ensureMotionStyles();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 14 14",
				fill: "none",
				"aria-hidden": "true",
				style: props.spinning === true ? { animation: "dsh-provider-spin 0.8s linear infinite" } : void 0,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fill: "currentColor",
					d: REFRESH_PATH
				})
			});
		}
		/** Icon-only refresh control used by every provider usage block. */
		function UsageRefreshButton(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: iconButtonStyle$1,
				disabled: props.disabled === true,
				"aria-label": props.spinning ? props.busyLabel : props.label,
				onClick: props.onClick,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshIcon, { spinning: props.spinning })
			});
		}
		/** Quota chart skeleton: same 14px tracks as live bars, with a moving sheen. */
		function UsageSkeleton(props) {
			ensureMotionStyles();
			const rows = props.rows ?? 2;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				"aria-hidden": "true",
				children: Array.from({ length: rows }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 6
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							...chipStyle,
							width: index === 0 ? 92 : 78
						} }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							...chipStyle,
							width: 36
						} })]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: trackStyle,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: shimmerStyle })
					})]
				}, index))
			});
		}
		/**
		* Title + official refresh glyph used above usage bars.
		* @param props.title - localized usage heading.
		* @param props.spinning - whether a refresh is in flight.
		* @param props.disabled - when true, the refresh button is inert.
		* @param props.refreshLabel - idle aria-label.
		* @param props.busyLabel - aria-label while spinning.
		* @param props.onRefresh - fetch handler.
		* @param props.error - short failure hint shown left of the button.
		* @returns the usage block heading row.
		*/
		function UsageHeader(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 10
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					style: {
						margin: 0,
						fontSize: 13,
						fontWeight: 600,
						lineHeight: "18px"
					},
					children: props.title
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						flex: "none"
					},
					children: [props.error !== void 0 && props.error.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							fontSize: 12,
							lineHeight: "18px",
							color: "var(--dsw-alias-state-error-primary)"
						},
						children: props.error
					}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageRefreshButton, {
						spinning: props.spinning,
						disabled: props.disabled === true,
						label: props.refreshLabel,
						busyLabel: props.busyLabel,
						onClick: props.onRefresh
					})]
				})]
			});
		}
		/** Format a usage stamp as a compact local clock, e.g. "12:04". */
		function formatUsageClock(at) {
			return at.toLocaleTimeString(void 0, {
				hour: "2-digit",
				minute: "2-digit",
				hour12: false
			});
		}
		function interpolateCopy(template, params) {
			return template.replace(/\{(\w+)\}/gu, (_match, key) => String(params[key] ?? ""));
		}
		function chineseLocale(locales) {
			const locale = typeof locales === "string" ? locales : locales?.[0] ?? (typeof document === "undefined" ? void 0 : document.documentElement.lang || void 0);
			return typeof locale === "string" && /^zh\b/iu.test(locale);
		}
		function pad2(value) {
			return String(value).padStart(2, "0");
		}
		/** Official grok.com form: 2026年8月20日 11:35. English stays a short local datetime. */
		function formatResetStamp(iso, locales) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			if (chineseLocale(locales)) return String(at.getFullYear()) + "年" + String(at.getMonth() + 1) + "月" + String(at.getDate()) + "日 " + pad2(at.getHours()) + ":" + pad2(at.getMinutes());
			return new Intl.DateTimeFormat(locales, {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				hour12: false
			}).format(at);
		}
		/** Official Cursor form: Sep 16 / 9月16日. */
		function formatResetDate(iso, locales) {
			const at = new Date(iso);
			if (Number.isNaN(at.getTime())) return iso;
			if (chineseLocale(locales)) return String(at.getMonth() + 1) + "月" + String(at.getDate()) + "日";
			return new Intl.DateTimeFormat(locales, {
				month: "short",
				day: "numeric"
			}).format(at);
		}
		/** Whole days until reset when at least one day remains; otherwise the datetime form is used. */
		function remainingResetDays(iso, now = Date.now()) {
			const at = Date.parse(iso);
			if (!Number.isFinite(at)) return void 0;
			const days = Math.round((at - now) / 864e5);
			return days >= 1 ? days : void 0;
		}
		/** Localized reset line matching official dashboards. */
		function resetLabelOf(iso, copy, now) {
			if (iso === void 0) return void 0;
			const locales = copy.at.includes("重置") ? "zh-CN" : "en";
			const days = remainingResetDays(iso, now);
			if (days !== void 0) return interpolateCopy(copy.atDays, {
				date: formatResetDate(iso, locales),
				count: days
			});
			return interpolateCopy(copy.at, { time: formatResetStamp(iso, locales) });
		}
		/**
		* Last successful usage read, right-aligned under the bars.
		* @param props.at - when the last successful snapshot arrived.
		* @param props.label - already-localized "12:04 已更新".
		* @returns the stamp, or nothing before the first success.
		*/
		function UsageUpdatedAt(props) {
			if (props.at === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					textAlign: "right",
					fontSize: 12,
					lineHeight: "18px",
					color: "var(--dsw-alias-label-tertiary)"
				},
				children: props.label
			});
		}
		const providerHeaderStyle = {
			boxSizing: "border-box",
			width: "100%",
			minHeight: 76,
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 16,
			border: 0,
			padding: "12px 14px",
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		//#endregion
		//#region ../dsh-llm-providers-ui/lib/provider-ui.js
		/** Plain-object guard shared by the reader factories and the sidebar cache validator. */
		function recordUsageValue(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
		}
		/** Non-empty string guard shared by the reader factories and the sidebar cache validator. */
		function nonEmptyString(value) {
			return typeof value === "string" && value.length > 0;
		}
		function finiteNumber(value) {
			return typeof value === "number" && Number.isFinite(value);
		}
		/** Non-negative finite number guard shared by the reader factories and the sidebar cache validator. */
		function nonNegativeNumber(value) {
			return finiteNumber(value) && value >= 0;
		}
		const SHORT_LABELS = [
			[/five|5h|5-hour/u, "5h"],
			[/two-hour|2-hour|2h/u, "2h"],
			[/session/u, "S"],
			[/week|周/u, "W"],
			[/month|月/u, "M"],
			[/credit/u, "Cr"],
			[/agent/u, "A"],
			[/daily|day/u, "D"],
			[/local/u, "L"],
			[/other/u, "Oth"]
		];
		function shortLabel(value) {
			const normalized = value.toLowerCase();
			if (/^\d+h$/u.test(normalized)) return normalized;
			return SHORT_LABELS.find(([pattern]) => pattern.test(normalized))?.[1] ?? value.slice(0, 4);
		}
		const MONTHLY_PERIOD_RANK = 6;
		const PERIOD_RANK = {
			M: MONTHLY_PERIOD_RANK,
			W: 5,
			D: 4,
			CURS: 3,
			S: 1,
			A: 0,
			L: 0,
			CR: -1
		};
		function periodTokenRank(value) {
			const normalized = shortLabel(value).toUpperCase();
			return PERIOD_RANK[normalized] ?? (/^\d+H$/.test(normalized) ? 2 : 0);
		}
		function periodRank(quotaWindow) {
			return Math.max(periodTokenRank(quotaWindow.shortLabel), periodTokenRank(quotaWindow.label), periodTokenRank(quotaWindow.id));
		}
		/** Headline window: longest remaining-percent period. Text-only windows are skipped. */
		function pickPrimaryWindow(windows) {
			let best;
			for (const quotaWindow of windows) {
				if (quotaWindow.remainingPercent === void 0) continue;
				if (best === void 0 || periodRank(quotaWindow) > periodRank(best)) best = quotaWindow;
			}
			if (best !== void 0 && best.remainingPercent === 100 && !nonEmptyString(best.resetsAt) && periodRank(best) < MONTHLY_PERIOD_RANK) {
				let fallback;
				for (const quotaWindow of windows) {
					if (quotaWindow === best || !nonEmptyString(quotaWindow.resetsAt) || quotaWindow.remainingPercent === void 0) continue;
					if (fallback === void 0 || periodRank(quotaWindow) > periodRank(fallback)) fallback = quotaWindow;
				}
				if (fallback !== void 0) return fallback;
			}
			return best;
		}
		/** Shortest period first: 5-hour, week, month. Cached summaries keep emission order, so display sorts. */
		function displayWindowRank(quotaWindow) {
			const id = quotaWindow.id.toLowerCase();
			const shortLabelValue = quotaWindow.shortLabel.toLowerCase();
			if (id === "fivehour" || id === "five-hour" || id === "5h" || shortLabelValue === "5h") return 0;
			if (id === "weekly" || id === "week" || shortLabelValue === "w") return 1;
			if (id === "monthly" || id === "month" || shortLabelValue === "m") return 2;
			return 3;
		}
		function orderUsageWindows(windows) {
			return [...windows].sort((left, right) => displayWindowRank(left) - displayWindowRank(right));
		}
		function formatRemainingDuration(ms) {
			const rtf = new Intl.RelativeTimeFormat(void 0, { numeric: "always" });
			const days = Math.round(ms / 864e5);
			if (Math.abs(days) >= 1) return rtf.format(days, "day");
			const hours = Math.round(ms / 36e5);
			if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
			const minutes = Math.max(1, Math.round(Math.abs(ms) / 6e4));
			return rtf.format(ms < 0 ? -minutes : minutes, "minute");
		}
		function parseResetTime(resetsAt) {
			if (/^\d{4}-\d{2}-\d{2}/u.test(resetsAt)) {
				const iso = Date.parse(resetsAt);
				return Number.isFinite(iso) ? iso : void 0;
			}
			if (!/^\d{10,}$/u.test(resetsAt)) return void 0;
			const n = Number(resetsAt);
			if (!Number.isFinite(n) || n <= 0) return void 0;
			return n < 0xe8d4a51000 ? n * 1e3 : n;
		}
		/** System-zone instant for a reset ISO. Language copy stays in the UI. */
		function formatResetInstant(resetsAt) {
			if (!nonEmptyString(resetsAt)) return void 0;
			const time = parseResetTime(resetsAt);
			if (time === void 0) return void 0;
			const delta = time - Date.now();
			if (delta < -3456e7 || delta > 6912e7) return void 0;
			return {
				when: new Intl.DateTimeFormat(void 0, {
					dateStyle: "short",
					timeStyle: "short"
				}).format(new Date(time)),
				overdue: delta <= 0,
				relative: formatRemainingDuration(delta)
			};
		}
		const USAGE_CACHE_KEY = "dsh-llm-providers-ui:usage-cache";
		/**
		* Browser last-good usage cache shared across bundles: the sidebar store and
		* each provider Settings card bundle their own copy of this module, so the
		* module-level memory map below is per-bundle while storage is shared.
		* Readable storage is authoritative, including empty after invalidation; memory
		* is only a fallback while storage is unavailable. Stale status persists
		* honestly, and collapsed-header headlines never replace a full multi-window
		* summary (a later full read upgrades a headline).
		*/
		let memoryUsageCache = /* @__PURE__ */ new Map();
		/** Whether a ready or stale summary retains displayable usage windows.
		* @param summary - Current or retained provider usage.
		* @returns Whether its windows can be displayed and persisted.
		*/
		function hasUsageData(summary) {
			return summary !== void 0 && summary.windows.length > 0 && (summary.status === "ready" || summary.status === "stale");
		}
		function cachedSummary(value) {
			const item = recordUsageValue(value);
			if (item === void 0 || !nonEmptyString(item.providerKey) || !nonEmptyString(item.name)) return void 0;
			const status = item.status;
			if (status !== "ready" && status !== "stale") return void 0;
			if (!Array.isArray(item.windows) || item.windows.length === 0) return void 0;
			const windows = [];
			for (const windowValue of item.windows) {
				const quotaWindow = recordUsageValue(windowValue);
				if (quotaWindow === void 0 || !nonEmptyString(quotaWindow.id) || !nonEmptyString(quotaWindow.label) || !nonEmptyString(quotaWindow.shortLabel) || !nonEmptyString(quotaWindow.valueText)) return void 0;
				if (quotaWindow.remainingPercent !== void 0 && (!nonNegativeNumber(quotaWindow.remainingPercent) || quotaWindow.remainingPercent > 100)) return void 0;
				if (quotaWindow.resetsAt !== void 0 && !nonEmptyString(quotaWindow.resetsAt)) return void 0;
				windows.push({
					id: quotaWindow.id,
					label: quotaWindow.label,
					shortLabel: quotaWindow.shortLabel,
					valueText: quotaWindow.valueText,
					...quotaWindow.remainingPercent === void 0 ? {} : { remainingPercent: quotaWindow.remainingPercent },
					...quotaWindow.resetsAt === void 0 ? {} : { resetsAt: quotaWindow.resetsAt }
				});
			}
			return {
				providerKey: item.providerKey,
				name: item.name,
				status,
				windows: orderUsageWindows(windows),
				...nonEmptyString(item.fetchedAt) ? { fetchedAt: item.fetchedAt } : {}
			};
		}
		/** Readable storage backends. A backend that throws on read is unusable and skipped. */
		function usageStorageBackends() {
			const backends = [];
			for (const name of ["localStorage", "sessionStorage"]) try {
				const backend = globalThis[name];
				if (backend === void 0 || backend === null) continue;
				backend.getItem(USAGE_CACHE_KEY);
				backends.push(backend);
			} catch {}
			return backends;
		}
		function storageRead() {
			const backends = usageStorageBackends();
			if (backends.length === 0) return {
				available: false,
				raw: null
			};
			for (const backend of backends) try {
				const raw = backend.getItem(USAGE_CACHE_KEY);
				if (raw !== null) return {
					available: true,
					raw
				};
			} catch {}
			return {
				available: true,
				raw: null
			};
		}
		function storageWrite(value) {
			for (const backend of usageStorageBackends()) try {
				backend.setItem(USAGE_CACHE_KEY, value);
			} catch {}
		}
		function parseUsageCache(raw) {
			const cached = /* @__PURE__ */ new Map();
			if (raw === null) return cached;
			try {
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return cached;
				for (const value of parsed) {
					const item = cachedSummary(value);
					if (item !== void 0) cached.set(item.providerKey, item);
				}
			} catch {}
			return cached;
		}
		function readUsageCache() {
			const { available, raw } = storageRead();
			if (!available) return new Map(memoryUsageCache);
			const fromStorage = parseUsageCache(raw);
			memoryUsageCache = new Map(fromStorage);
			return fromStorage;
		}
		/** Persistable copy: status stays ready/stale as the caller holds it, never laundered to ready. */
		function persistableUsage(summary) {
			return {
				providerKey: summary.providerKey,
				name: summary.name,
				status: summary.status,
				windows: orderUsageWindows(summary.windows),
				...summary.fetchedAt === void 0 ? {} : { fetchedAt: summary.fetchedAt }
			};
		}
		/** A collapsed-header single window, never a full multi-window summary. */
		function isHeadlineOnly(summary) {
			return summary.windows.length === 1 && summary.windows[0]?.id === "headline";
		}
		function writeUsageCache(current) {
			const entries = [...current.values()].filter(hasUsageData);
			const { available, raw } = storageRead();
			if (!available) {
				for (const item of entries) memoryUsageCache.set(item.providerKey, persistableUsage(item));
				return;
			}
			const merged = parseUsageCache(raw);
			for (const item of entries) {
				const previous = merged.get(item.providerKey);
				if (previous !== void 0 && !isHeadlineOnly(previous) && isHeadlineOnly(item)) continue;
				merged.set(item.providerKey, persistableUsage(item));
			}
			memoryUsageCache = new Map(merged);
			if (merged.size === 0) return;
			storageWrite(JSON.stringify([...merged.values()]));
		}
		function dropPersistedUsageKeys(keys) {
			const drop = new Set(keys);
			for (const key of drop) memoryUsageCache.delete(key);
			const { available, raw } = storageRead();
			if (!available || raw === null) return;
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return;
			}
			if (!Array.isArray(parsed)) return;
			const kept = parsed.filter((value) => {
				const item = recordUsageValue(value);
				return item === void 0 || !nonEmptyString(item.providerKey) || !drop.has(item.providerKey);
			});
			if (kept.length === parsed.length) return;
			storageWrite(JSON.stringify(kept));
		}
		/** Last-good quota for a Provider card header, available on first paint. */
		function peekCachedUsage(providerKey) {
			return readUsageCache().get(providerKey);
		}
		function rememberCachedUsage(summary) {
			if (!hasUsageData(summary)) return;
			writeUsageCache(/* @__PURE__ */ new Map([[summary.providerKey, summary]]));
		}
		/**
		* Collapsed-header last-good quota for first paint. Ignores headlines without
		* a finite in-range remaining percent so missing quota renders no meter, never
		* a zero bar. Never replaces a cached full multi-window summary, and records
		* no fetchedAt: a headline is display data, not a fetch, so freshness checks
		* treat it as expired and refetch.
		*/
		function rememberHeadlineQuota(providerKey, name, quota) {
			if (quota?.remainingPercent === void 0 || !Number.isFinite(quota.remainingPercent)) return;
			const remainingPercent = Math.round(quota.remainingPercent * 10) / 10;
			if (remainingPercent < 0 || remainingPercent > 100) return;
			const label = quota.label ?? "Quota";
			rememberCachedUsage({
				providerKey,
				name,
				status: "ready",
				windows: [{
					id: "headline",
					label,
					shortLabel: label,
					valueText: String(remainingPercent) + "%",
					remainingPercent
				}]
			});
		}
		function headerQuotaFromCache(summary) {
			if (summary === void 0) return void 0;
			const quotaWindow = pickPrimaryWindow(summary.windows);
			if (quotaWindow === void 0) return void 0;
			const instant = formatResetInstant(quotaWindow.resetsAt);
			const detail = instant === void 0 ? void 0 : instant.when;
			return {
				label: quotaWindow.shortLabel || quotaWindow.label,
				...quotaWindow.remainingPercent === void 0 ? {} : { remainingPercent: quotaWindow.remainingPercent },
				...detail === void 0 ? {} : { detail }
			};
		}
		/**
		* Remaining quota for a provider card header, from one cache shared with the
		* Provider Usage sidebar. The first frame paints the cached entry, a live answer
		* wins and is written back, and a known sign-out drops the entry rather than
		* leaving another account's quota behind.
		* @param providerKey - usage cache key, identical to the sidebar reader's key.
		* @param providerName - display name recorded with the cached quota.
		* @param quota - the live answer, or null while none has arrived. Only the label and
		* the remaining percent are persisted, because that is all a stored headline holds.
		* @param auth - settled state of the account read.
		* @returns the live quota, else the cached one; null when withheld or when neither is displayable.
		*/
		function useProviderQuotaCache(providerKey, providerName, quota, auth) {
			const { answered, signedOut, withheld } = auth;
			(0, react.useEffect)(() => {
				if (signedOut) {
					if (answered) dropPersistedUsageKeys([providerKey]);
					return;
				}
				if (withheld === true) return;
				if (quota !== null) rememberHeadlineQuota(providerKey, providerName, quota);
			}, [
				answered,
				signedOut,
				withheld,
				providerKey,
				providerName,
				quota?.remainingPercent,
				quota?.label
			]);
			const cached = (0, react.useMemo)(() => answered && signedOut ? void 0 : headerQuotaFromCache(peekCachedUsage(providerKey)), [
				answered,
				signedOut,
				providerKey
			]);
			return withheld === true ? null : quota ?? cached ?? null;
		}
		[
			"[data-provider-card]{box-sizing:border-box;width:100%;min-width:0;list-style:none;margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible}",
			"[data-provider-card-header]{box-sizing:border-box;width:100%;min-height:76px!important;display:flex;align-items:center;justify-content:space-between;gap:16px;border:0;padding:12px 14px!important;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer}",
			"[data-provider-body][hidden]{display:none!important}",
			"[data-provider-role-badge] svg{width:12px;height:12px}",
			"[data-provider-card-header]:hover{background:color-mix(in srgb, var(--dsw-alias-label-primary) 4%, transparent)}",
			"[data-provider-body]{display:flex;flex-direction:column;gap:18px;border-top:1px solid var(--dsw-alias-border-l2);padding:16px 14px 18px}",
			"[data-provider-model]{display:flex;align-items:center;gap:9px;min-height:40px}",
			"[data-provider-quota-mini]{display:block}",
			"[data-providers-list]{display:flex;flex-direction:column}",
			"[data-providers-list] [data-sortable-row]+[data-sortable-row]{border-top:1px solid var(--dsw-alias-border-l2)}",
			"[data-providers-section]{container-type:inline-size}",
			"@media (max-width:680px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@container (max-width:540px){[data-provider-card-header]{min-height:106px!important;padding:17px 4px!important}[data-provider-header-main]{display:grid!important;grid-template-columns:minmax(0,1fr) auto;gap:7px 9px!important;align-items:center}[data-provider-header-identity]{grid-column:1;grid-row:1;gap:9px!important}[data-provider-header-mark]{width:25px!important;height:25px!important}[data-provider-role-badge]{margin-left:4px;font-size:9px!important}[data-provider-role-badge] svg{width:11px!important;height:11px!important}[data-provider-header-side]{grid-column:2;grid-row:1;justify-self:end}[data-provider-header-side] [data-provider-header-chevron]{width:18px}[data-provider-quota-mini]{grid-column:1;grid-row:2;width:auto!important;max-width:none!important;text-align:left;padding-left:34px!important}[data-provider-header-status]{grid-column:2;grid-row:2;width:auto!important;max-width:100px}[data-provider-model]{min-height:48px}[data-provider-model] input[type=checkbox]{width:17px;height:17px}[data-providers-section] button,[data-provider-card] button{min-height:44px}}",
			"@media (pointer:coarse){[data-sortable-handle],[data-sortable-move]{min-width:44px;min-height:44px}}"
		].join("\n");
		//#endregion
		//#region src/client/usage-reader.ts
		const VIEW_CACHE_KEY = "dsh-llm-opencode-go:usage-view";
		let memoryView;
		const WINDOWS_EN = [
			{
				id: "session",
				label: "5-hour window",
				shortLabel: "5h"
			},
			{
				id: "weekly",
				label: "Weekly window",
				shortLabel: "W"
			},
			{
				id: "monthly",
				label: "Monthly window",
				shortLabel: "M"
			}
		];
		const WINDOWS_ZH = [
			{
				id: "session",
				label: "5 小时窗口",
				shortLabel: "5h"
			},
			{
				id: "weekly",
				label: "每周额度",
				shortLabel: "W"
			},
			{
				id: "monthly",
				label: "每月额度",
				shortLabel: "M"
			}
		];
		function uiZh() {
			return (typeof document === "undefined" ? "" : document.documentElement.lang).toLowerCase().startsWith("zh");
		}
		function remainingPercent(used) {
			return Math.max(0, Math.min(100, Math.round((1 - used) * 1e3) / 10));
		}
		function peekOpenCodeGoUsageView() {
			if (memoryView !== void 0) return memoryView;
			try {
				const raw = globalThis.sessionStorage?.getItem(VIEW_CACHE_KEY) ?? globalThis.localStorage?.getItem(VIEW_CACHE_KEY);
				if (raw === null || raw === void 0) return void 0;
				const parsed = decodeOpenCodeGoUsageView(JSON.parse(raw));
				if (parsed === void 0) return void 0;
				memoryView = parsed;
				return parsed;
			} catch {
				return;
			}
		}
		function windowsOf(view) {
			const zh = uiZh();
			const windows = [];
			for (const meta of zh ? WINDOWS_ZH : WINDOWS_EN) {
				const window = view[meta.id];
				if (window === void 0) continue;
				const remaining = remainingPercent(window.usage);
				const resetsAt = resetLabelOf(window.resetsAt, zh ? {
					at: "重置时间：{time}",
					atDays: "重置时间：{date}（还剩 {count} 天）"
				} : {
					at: "Resets {time}",
					atDays: "Usage limits reset on {date} ({count} days left)"
				});
				windows.push({
					id: meta.id,
					label: meta.label,
					shortLabel: meta.shortLabel,
					remainingPercent: remaining,
					valueText: String(remaining) + "%",
					...resetsAt === void 0 ? {} : { resetsAt }
				});
			}
			return windows;
		}
		/**
		* Persist a decoded usage view for this card's legacy first paint.
		* Writes only the plugin-private view cache, never the store-owned shared quota cache.
		* @param view - decoded Host usage snapshot.
		*/
		function persistOpenCodeGoUsage(view) {
			memoryView = view;
			try {
				const raw = JSON.stringify(view);
				globalThis.sessionStorage?.setItem(VIEW_CACHE_KEY, raw);
				globalThis.localStorage?.setItem(VIEW_CACHE_KEY, raw);
			} catch {}
		}
		function createOpenCodeGoUsageReader() {
			return {
				providerKey: OPENCODE_GO_ENTRY_ID,
				name: "OpenCode Go",
				async read(rpc, _refresh, signal) {
					const result = await rpc.call("/api", OPENCODE_GO_RPC_ENDPOINT, {
						endpoint: OPENCODE_GO_USAGE_ENDPOINT,
						payload: {}
					}, signal);
					if (!result.ok) return {
						status: "error",
						message: result.error.message
					};
					const reply = decodeOpenCodeGoUsageReply(result.value);
					if (reply === void 0) return {
						status: "error",
						message: "Invalid OpenCode Go usage response"
					};
					if (reply.status !== "ok") return { status: "unsupported" };
					persistOpenCodeGoUsage(reply.usage);
					return {
						status: "ready",
						fetchedAt: reply.usage.fetchedAt,
						windows: windowsOf(reply.usage)
					};
				}
			};
		}
		//#endregion
		//#region ../dsh-llm-providers-ui/lib/sortable.js
		/** Pointer-driven sortable list with a floating ghost and animated live preview. */
		const listStyle$1 = {
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowStyle = {
			display: "grid",
			gridTemplateColumns: "30px minmax(0, 1fr)",
			alignItems: "stretch",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			transition: "box-shadow 150ms ease, opacity 150ms ease, transform 150ms ease"
		};
		const handleStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 30,
			minHeight: 42,
			alignSelf: "stretch",
			border: 0,
			borderRight: "1px solid var(--dsw-alias-border-l2)",
			padding: 0,
			flex: "none",
			touchAction: "none",
			userSelect: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			position: "relative",
			zIndex: 2
		};
		const cardRowStyle = {
			...rowStyle,
			borderRadius: 10,
			background: "var(--dsw-alias-bg-module-platform)",
			overflow: "hidden"
		};
		const cardItemStyle = {
			minWidth: 0,
			display: "flex",
			flexDirection: "column"
		};
		const bareRowStyle = {
			...rowStyle,
			border: 0,
			borderRadius: 0,
			background: "transparent",
			overflow: "visible"
		};
		const bareHandleStyle = {
			...handleStyle,
			width: 22,
			minHeight: 0,
			borderRight: 0,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const plainRowStyle = {
			display: "grid",
			alignItems: "stretch",
			background: "transparent"
		};
		const plainItemStyle = {
			minWidth: 0,
			display: "flex",
			flexDirection: "column",
			padding: "4px 0"
		};
		const moveButtonStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			minWidth: 34,
			minHeight: 34,
			alignSelf: "center",
			border: 0,
			padding: 0,
			flex: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 16,
			cursor: "pointer"
		};
		const touchCss = "@media (pointer:coarse){[data-sortable-handle],[data-sortable-move]{min-width:44px;min-height:44px}}";
		const cardCss = "[data-sortable-card] [data-sortable-item] li,[data-sortable-ghost] [data-sortable-item] li{border:0!important;border-radius:0!important;background:transparent!important;overflow:visible!important;list-style:none;margin:0}";
		/** Grip glyph marking one row's pointer handle. */
		function IconGrip() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "10",
				height: "14",
				viewBox: "0 0 10 14",
				fill: "currentColor",
				"aria-hidden": true,
				children: [
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "2.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "2.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "7",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "7",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "11.5",
						r: "1.2"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "11.5",
						r: "1.2"
					})
				]
			});
		}
		/**
		* Pointer-driven sortable list: an in-tree floating ghost follows the pointer,
		* a preview array records the prospective order, and FLIP animations move
		* sibling rows. The ghost stays inside the list ancestry so ancestor-scoped
		* row styles keep matching it while it floats (position:fixed escapes
		* overflow clipping without leaving the scope). Constraint: no
		* transform/filter/perspective on list ancestors, which would re-anchor
		* the fixed ghost to that ancestor instead of the viewport.
		*/
		function SortableList({ items, getId, renderItem, dragLabel, onReorder, disabled = false, chrome = "row", sorting = true, moveButtons = false, moveUpLabel, moveDownLabel }) {
			const card = chrome === "card";
			const plain = chrome === "plain";
			const bare = chrome === "bare";
			const interactive = sorting && !disabled;
			const showHandle = sorting;
			const upLabel = moveUpLabel ?? (() => "Move up");
			const downLabel = moveDownLabel ?? (() => "Move down");
			/** Commit a durable reorder moving one row by an offset. Pointer preview stays untouched. */
			const moveBy = (id, offset) => {
				if (!interactive || draggedId !== null) return;
				const from = items.findIndex((item) => getId(item) === id);
				if (from < 0) return;
				const to = from + offset;
				if (to < 0 || to >= items.length) return;
				const next = [...items];
				const moved = next.splice(from, 1)[0];
				if (moved === void 0) return;
				next.splice(to, 0, moved);
				onReorder(next);
			};
			/** Arrow keys on a handle commit the same reorder as a pointer drag. */
			const handleKeyDown = (event, id) => {
				if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
				event.preventDefault();
				moveBy(id, event.key === "ArrowUp" ? -1 : 1);
			};
			const [draggedId, setDraggedId] = (0, react.useState)(null);
			const [dropTargetId, setDropTargetId] = (0, react.useState)(null);
			const [previewItems, setPreviewItems] = (0, react.useState)(null);
			const [dragGhost, setDragGhost] = (0, react.useState)(null);
			const rowRefs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const previousRects = (0, react.useRef)(null);
			const previewRef = (0, react.useRef)(null);
			const dragGhostRef = (0, react.useRef)(null);
			const renderedItems = previewItems ?? items;
			const draggedItem = draggedId === null ? void 0 : renderedItems.find((item) => getId(item) === draggedId) ?? items.find((item) => getId(item) === draggedId);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const style = document.createElement("style");
				style.textContent = "html.providers-sortable-dragging, html.providers-sortable-dragging * { cursor: grabbing !important; user-select: none !important; }";
				const previousRootCursor = document.documentElement.style.cursor;
				const previousBodyCursor = document.body.style.cursor;
				document.head.appendChild(style);
				document.documentElement.classList.add("providers-sortable-dragging");
				document.documentElement.style.cursor = "grabbing";
				document.body.style.cursor = "grabbing";
				return () => {
					document.documentElement.classList.remove("providers-sortable-dragging");
					style.remove();
					document.documentElement.style.cursor = previousRootCursor;
					document.body.style.cursor = previousBodyCursor;
				};
			}, [draggedId]);
			(0, react.useEffect)(() => {
				if (draggedId === null) return;
				const handlePointerMove = (event) => {
					const currentGhost = dragGhostRef.current;
					if (currentGhost === null) return;
					event.preventDefault();
					const nextGhost = {
						...currentGhost,
						x: event.clientX - currentGhost.offsetX,
						y: event.clientY - currentGhost.offsetY
					};
					dragGhostRef.current = nextGhost;
					setDragGhost(nextGhost);
					movePreviewFromPointer(nextGhost.y + nextGhost.height / 2);
				};
				const handlePointerUp = (event) => {
					event.preventDefault();
					finishDrag(true);
				};
				const handlePointerCancel = (event) => {
					event.preventDefault();
					finishDrag(false);
				};
				const handleKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					finishDrag(false);
				};
				window.addEventListener("pointermove", handlePointerMove, { passive: false });
				window.addEventListener("pointerup", handlePointerUp, { passive: false });
				window.addEventListener("pointercancel", handlePointerCancel, { passive: false });
				window.addEventListener("keydown", handleKeyDown);
				return () => {
					window.removeEventListener("pointermove", handlePointerMove);
					window.removeEventListener("pointerup", handlePointerUp);
					window.removeEventListener("pointercancel", handlePointerCancel);
					window.removeEventListener("keydown", handleKeyDown);
				};
			}, [draggedId]);
			(0, react.useLayoutEffect)(() => {
				const rects = previousRects.current;
				if (rects === null) return;
				previousRects.current = null;
				rowRefs.current.forEach((node, id) => {
					const previous = rects.get(id);
					if (previous === void 0) return;
					const next = node.getBoundingClientRect();
					const deltaX = previous.left - next.left;
					const deltaY = previous.top - next.top;
					if (deltaX === 0 && deltaY === 0 || typeof node.animate !== "function") return;
					node.animate([{ transform: "translate(" + String(deltaX) + "px, " + String(deltaY) + "px)" }, { transform: "translate(0, 0)" }], {
						duration: 160,
						easing: "cubic-bezier(0.2, 0, 0, 1)"
					});
				});
			}, [renderedItems]);
			const startDrag = (event, id) => {
				if (!interactive || dragGhostRef.current !== null) return;
				if (event.pointerType === "mouse" && event.button !== 0) return;
				const row = event.currentTarget.closest("[data-sortable-row=\"true\"]");
				if (!(row instanceof HTMLElement)) return;
				event.preventDefault();
				if (typeof event.currentTarget.focus === "function") event.currentTarget.focus();
				try {
					event.currentTarget.setPointerCapture(event.pointerId);
				} catch {}
				const rect = row.getBoundingClientRect();
				const nextGhost = {
					id,
					x: rect.left,
					y: rect.top,
					width: rect.width,
					height: rect.height,
					offsetX: event.clientX - rect.left,
					offsetY: event.clientY - rect.top
				};
				dragGhostRef.current = nextGhost;
				const initial = [...items];
				previewRef.current = initial;
				setPreviewItems(initial);
				setDragGhost(nextGhost);
				setDraggedId(id);
			};
			const finishDrag = (commit) => {
				const next = previewRef.current;
				if (commit && next !== null && !sameOrder(next, items, getId)) onReorder(next);
				previewRef.current = null;
				dragGhostRef.current = null;
				setPreviewItems(null);
				setDragGhost(null);
				setDraggedId(null);
				setDropTargetId(null);
			};
			const captureRects = () => {
				previousRects.current = new Map(Array.from(rowRefs.current.entries()).map(([id, node]) => [id, node.getBoundingClientRect()]));
			};
			const setRowRef = (id, node) => {
				if (node === null) rowRefs.current.delete(id);
				else rowRefs.current.set(id, node);
			};
			/** The ghost clones live row controls: keep the copy unfocusable. React 18 types no inert prop, so set the DOM flag behind a support guard. */
			const setGhostInert = (node) => {
				if (node !== null && "inert" in node) node.inert = true;
			};
			const movePreviewFromPointer = (pointerY) => {
				if (draggedId === null) return;
				const current = previewRef.current ?? [...items];
				const from = current.findIndex((item) => getId(item) === draggedId);
				if (from < 0) return;
				const dragged = current[from];
				if (dragged === void 0) return;
				const remaining = current.filter((item) => getId(item) !== draggedId);
				let insertionIndex = remaining.length;
				let nextDropTargetId = remaining.length === 0 ? null : getId(remaining[remaining.length - 1]);
				for (let index = 0; index < remaining.length; index += 1) {
					const item = remaining[index];
					if (item === void 0) continue;
					const id = getId(item);
					const node = rowRefs.current.get(id);
					if (node === void 0) continue;
					const rect = node.getBoundingClientRect();
					if (pointerY < rect.top + rect.height / 2) {
						insertionIndex = index;
						nextDropTargetId = id;
						break;
					}
				}
				const next = [
					...remaining.slice(0, insertionIndex),
					dragged,
					...remaining.slice(insertionIndex)
				];
				setDropTargetId(nextDropTargetId);
				if (sameOrder(next, current, getId)) return;
				captureRects();
				previewRef.current = next;
				setPreviewItems(next);
			};
			const rowChromeStyle = bare ? bareRowStyle : plain ? plainRowStyle : card ? cardRowStyle : rowStyle;
			const rowGridColumns = (showHandle ? "44px " : "") + "minmax(0,1fr)" + (moveButtons && showHandle ? " auto auto" : "");
			const rowItemStyle = plain ? plainItemStyle : card ? cardItemStyle : { minWidth: 0 };
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-sortable-card": card ? "" : void 0,
				"data-sortable-plain": plain ? "" : void 0,
				style: {
					...listStyle$1,
					...card ? { gap: 12 } : {},
					...plain ? { gap: 0 } : {}
				},
				children: [
					card ? (0, react_jsx_runtime.jsx)("style", { children: cardCss }) : null,
					plain || moveButtons ? (0, react_jsx_runtime.jsx)("style", { children: touchCss }) : null,
					renderedItems.map((item, index) => {
						const id = getId(item);
						const dragging = draggedId === id;
						const targeted = dropTargetId === id && draggedId !== id;
						return (0, react_jsx_runtime.jsxs)("div", {
							ref: (node) => {
								setRowRef(id, node);
							},
							"data-sortable-row": "true",
							style: {
								...rowChromeStyle,
								gridTemplateColumns: rowGridColumns,
								visibility: dragging ? "hidden" : "visible",
								pointerEvents: dragging ? "none" : "auto",
								borderColor: dragging ? "transparent" : "var(--dsw-alias-border-l2)",
								boxShadow: targeted ? "0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)" : "none"
							},
							onPointerDown: (event) => {
								const target = event.target;
								if (target instanceof Element && target.closest("a, input, select, textarea, label, button:not([data-sortable-handle])") !== null) return;
								startDrag(event, id);
							},
							children: [
								(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-handle": "",
									style: {
										...bare ? bareHandleStyle : handleStyle,
										display: showHandle ? "flex" : "none",
										...plain ? { borderRight: 0 } : {},
										cursor: disabled ? "default" : draggedId === null ? "grab" : "grabbing"
									},
									"aria-label": dragLabel(item, index),
									"aria-grabbed": dragging,
									title: dragLabel(item, index),
									disabled,
									hidden: !showHandle,
									onDragStart: (event) => {
										event.preventDefault();
									},
									onPointerDown: (event) => {
										startDrag(event, id);
									},
									onKeyDown: (event) => {
										handleKeyDown(event, id);
									},
									children: (0, react_jsx_runtime.jsx)(IconGrip, {})
								}),
								(0, react_jsx_runtime.jsx)("div", {
									"data-sortable-item": "",
									style: rowItemStyle,
									children: renderItem(item, index)
								}),
								moveButtons ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-move": "up",
									style: {
										...moveButtonStyle,
										display: showHandle ? "inline-flex" : "none"
									},
									"aria-label": upLabel(item, index),
									title: upLabel(item, index),
									disabled: !interactive || index === 0,
									hidden: !showHandle,
									onClick: () => {
										moveBy(id, -1);
									},
									children: "↑"
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									"data-sortable-move": "down",
									style: {
										...moveButtonStyle,
										display: showHandle ? "inline-flex" : "none"
									},
									"aria-label": downLabel(item, index),
									title: downLabel(item, index),
									disabled: !interactive || index === renderedItems.length - 1,
									hidden: !showHandle,
									onClick: () => {
										moveBy(id, 1);
									},
									children: "↓"
								})] }) : null
							]
						}, id);
					}),
					dragGhost !== null && draggedItem !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						"data-sortable-row": "true",
						"data-sortable-ghost": "true",
						"aria-hidden": "true",
						ref: setGhostInert,
						style: {
							...rowChromeStyle,
							gridTemplateColumns: rowGridColumns,
							position: "fixed",
							boxSizing: "border-box",
							left: dragGhost.x,
							top: dragGhost.y,
							width: dragGhost.width,
							minHeight: dragGhost.height,
							zIndex: 1e4,
							pointerEvents: "none",
							opacity: .96,
							boxShadow: "var(--dsw-shadow-lv2, 0 10px 30px rgba(0, 0, 0, 0.18))",
							outline: "2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)"
						},
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								"data-sortable-handle": "",
								style: {
									...handleStyle,
									display: showHandle ? "flex" : "none",
									...plain ? { borderRight: 0 } : {},
									cursor: "grabbing"
								},
								children: (0, react_jsx_runtime.jsx)(IconGrip, {})
							}),
							(0, react_jsx_runtime.jsx)("div", {
								"data-sortable-item": "",
								style: rowItemStyle,
								children: renderItem(draggedItem, renderedItems.findIndex((item) => getId(item) === draggedId))
							}),
							moveButtons && showHandle ? (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: {
									...moveButtonStyle,
									visibility: "hidden"
								},
								children: "↑"
							}), (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								style: {
									...moveButtonStyle,
									visibility: "hidden"
								},
								children: "↓"
							})] }) : null
						]
					}) : null
				]
			});
		}
		function sameOrder(left, right, getId) {
			return left.length === right.length && left.every((item, index) => {
				const other = right[index];
				return other !== void 0 && getId(item) === getId(other);
			});
		}
		//#endregion
		//#region src/client/OpenCodeGoPluginCard.tsx
		/** OpenCode Go connection and model-catalog card for Plugin configuration. */
		const cardStyle = {
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 10,
			background: "var(--dsw-alias-bg-module-platform)"
		};
		const headerStyle$1 = providerHeaderStyle;
		const bodyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 18,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "16px 14px 18px"
		};
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12
		};
		const sectionTitleStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const fieldStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 6
		};
		const labelStyle = {
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		const hintStyle = {
			margin: 0,
			fontSize: 12,
			color: "var(--dsw-alias-label-tertiary)"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 10
		};
		const buttonStyle = {
			minHeight: 34,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			padding: "6px 14px",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			cursor: "pointer"
		};
		const primaryButtonStyle = {
			...buttonStyle,
			borderColor: "var(--dsw-alias-button-primary-fill)",
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const iconButtonStyle = {
			boxSizing: "border-box",
			width: 28,
			height: 28,
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			flex: "none",
			border: 0,
			borderRadius: 6,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)",
			font: "inherit",
			cursor: "pointer"
		};
		const disclosureStyle = {
			display: "inline-flex",
			alignItems: "center",
			gap: 8,
			minWidth: 0,
			border: 0,
			padding: 0,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		const statusStyle$1 = {
			margin: 0,
			fontSize: 13,
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle$1 = {
			...statusStyle$1,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const usageListStyle = {
			margin: 0,
			padding: 0,
			listStyle: "none",
			display: "flex",
			flexDirection: "column",
			gap: 2
		};
		let nextModelRow = 0;
		/** Stable client-only row identity used by the pointer sortable preview. */
		function newModelRowId() {
			nextModelRow += 1;
			return "opencode-go-model-row-" + String(nextModelRow);
		}
		function effortRow(id, thinkingEfforts) {
			return thinkingEfforts === void 0 ? {
				id,
				thinking: true
			} : {
				id,
				thinking: true,
				thinkingEfforts
			};
		}
		function modelDraftOf(model) {
			return {
				rowId: newModelRowId(),
				...model,
				contextWindow: model.contextWindow === void 0 ? "" : String(model.contextWindow),
				...model.defaultEffort === void 0 ? {} : { defaultEffort: model.defaultEffort }
			};
		}
		function draftOf(settings) {
			return {
				baseURL: settings.baseURL,
				models: settings.models.map(modelDraftOf)
			};
		}
		/** Same K/M spelling as Settings → Models: `1m` → 1000000, `256k` → 256000. */
		function integerOf(text) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return void 0;
			const match = /^(\d+(?:\.\d+)?)([km])?$/iu.exec(trimmed);
			if (match === null || match[1] === void 0) return NaN;
			const suffix = match[2]?.toLowerCase();
			const scale = suffix === "k" ? 1e3 : suffix === "m" ? 1e6 : 1;
			const scaled = Number(match[1]) * scale;
			const rounded = Math.round(scaled);
			const value = Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
			return Number.isSafeInteger(value) && value > 0 ? value : NaN;
		}
		function validURL(value) {
			try {
				const url = new URL(value);
				return url.protocol === "http:" || url.protocol === "https:";
			} catch {
				return false;
			}
		}
		function sameDraft(left, right) {
			return JSON.stringify(left) === JSON.stringify(right);
		}
		function modelSettingsOf(draft) {
			const { rowId: _rowId, contextWindow: contextText, tools: _tools, ...model } = draft;
			const contextWindow = integerOf(contextText);
			return {
				...model,
				id: model.id.trim(),
				...contextWindow === void 0 ? {} : { contextWindow }
			};
		}
		function settingsOf(draft, current) {
			return {
				...current,
				baseURL: draft.baseURL.trim(),
				models: draft.models.map(modelSettingsOf)
			};
		}
		function modelFailure(models) {
			const ids = /* @__PURE__ */ new Set();
			for (const model of models) {
				const id = model.id.trim();
				if (id.length === 0 || ids.has(id)) return true;
				ids.add(id);
				if (Number.isNaN(integerOf(model.contextWindow))) return true;
			}
			return false;
		}
		function usageErrorOf(error, t) {
			const raw = messageOf(error, t("requestFailed"));
			return /failed to fetch|could not reach|network|enotfound|econnreset|econnrefused|etimedout/i.test(raw) ? t("usageUnreachable") : raw;
		}
		function messageOf(error, fallback) {
			return error instanceof Error && error.message.length > 0 ? error.message : fallback;
		}
		/** Expansion-state key that survives id edits and preview reorders. */
		function rowKeyOf(model) {
			return model.rowId;
		}
		/** One capability checkbox. */
		/** Disclosure chevron; rotates to point down while open. */
		function IconChevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "12",
				height: "12",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				style: {
					flex: "none",
					transform: open ? "rotate(90deg)" : "none",
					transition: "transform 120ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 3.5L10.5 8L6 12.5",
					stroke: "currentColor",
					strokeWidth: "1.5",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		/** Removal glyph for one model row. */
		function IconTrash() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "14",
				height: "14",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9L12 4M6.5 6.8v4.4M9.5 6.8v4.4",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function usageResetCopy(t) {
			return {
				at: t("usageResetAt"),
				atDays: t("usageResetAtDays")
			};
		}
		function resetDetail(iso, t, fallback) {
			return resetLabelOf(iso, usageResetCopy(t)) ?? fallback;
		}
		function headlineQuota(usage, lastUsage, t) {
			const view = usage.status === "ready" ? usage.usage : lastUsage;
			const picked = view?.monthly !== void 0 ? {
				window: view.monthly,
				label: t("usageMonthly")
			} : view?.weekly !== void 0 ? {
				window: view.weekly,
				label: t("usageWeekly")
			} : view?.session !== void 0 ? {
				window: view.session,
				label: t("usageSession")
			} : void 0;
			if (picked !== void 0) {
				const detail = resetDetail(picked.window.resetsAt, t);
				return {
					label: picked.label,
					remainingPercent: remainingPercent(picked.window.usage),
					...detail === void 0 ? {} : { detail }
				};
			}
			if (usage.status === "error" || usage.status === "unsupported") return { label: t("usage") };
		}
		/** One quota window in remaining-percent Approved A meter language. */
		function UsageBar({ label, window: quota, t, fallbackReset }) {
			const detail = resetDetail(quota.resetsAt, t, fallbackReset);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderQuotaMeter, {
				label,
				remainingPercent: remainingPercent(quota.usage),
				...detail === void 0 ? {} : { detail }
			});
		}
		/** Render the single-package OpenCode Go contribution under Plugin configuration. */
		function OpenCodeGoPluginCard(props) {
			const { t } = props;
			const snapshot = props.useOpenCodeGoSettings((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			const initial = (0, react.useMemo)(() => snapshot.value === void 0 ? void 0 : draftOf(snapshot.value), [snapshot.value]);
			const [source, setSource] = (0, react.useState)(initial);
			const [draft, setDraft] = (0, react.useState)(initial);
			const [sourceRevision, setSourceRevision] = (0, react.useState)(snapshot.revision);
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [credential, setCredential] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [fetching, setFetching] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [notice, setNotice] = (0, react.useState)(void 0);
			const cachedUsage = peekOpenCodeGoUsageView();
			const [usage, setUsage] = (0, react.useState)(cachedUsage === void 0 ? { status: "idle" } : {
				status: "ready",
				usage: cachedUsage
			});
			const [lastUsage, setLastUsage] = (0, react.useState)(cachedUsage);
			const [usageUpdatedAt, setUsageUpdatedAt] = (0, react.useState)(void 0);
			const [catalogOpen, setCatalogOpen] = (0, react.useState)(false);
			const [modelSorting, setModelSorting] = (0, react.useState)(false);
			const [expandedModels, setExpandedModels] = (0, react.useState)(/* @__PURE__ */ new Set());
			const usageEpoch = (0, react.useRef)(0);
			const dirty = source !== void 0 && draft !== void 0 && (!sameDraft(source, draft) || apiKey.length > 0);
			(0, react.useEffect)(() => () => {
				usageEpoch.current++;
			}, []);
			(0, react.useEffect)(() => {
				if (snapshot.status !== "ready" || snapshot.value === void 0) return;
				if (snapshot.revision === sourceRevision) return;
				if (dirty) return;
				const next = draftOf(snapshot.value);
				setSource(next);
				setDraft(next);
				setSourceRevision(snapshot.revision);
			}, [
				dirty,
				snapshot.revision,
				snapshot.status,
				snapshot.value,
				sourceRevision
			]);
			const refreshCredential = async () => {
				try {
					setCredential(await props.describeCredential());
				} catch {
					setCredential(void 0);
				}
			};
			(0, react.useEffect)(() => {
				if (snapshot.status !== "ready") return;
				refreshCredential();
			}, [snapshot.status, snapshot.value?.apiKeyEnv]);
			(0, react.useEffect)(() => () => {
				props.closeModelPicker();
			}, [props.closeModelPicker]);
			if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				"data-provider-card": "",
				"data-provider-role": "llm",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"data-provider-card-header": "",
					"aria-expanded": open,
					"aria-label": t(open ? "collapse" : "expand") + ": " + t("title"),
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title: t("title"),
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: t("summaryModels").replace("{count}", "0"),
						status: t("summaryOff"),
						role: "llm",
						open
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: bodyStyle,
					"data-provider-body": "",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: statusStyle$1,
						role: "status",
						children: t("remoteAccess")
					})
				}) : null]
			});
			const title = t("title");
			const disabled = snapshot.status !== "ready" || !snapshot.writable || busy;
			const keyInvalid = apiKey.length > 0 && apiKey.trim().length === 0;
			const customModels = snapshot.user !== void 0 && Object.prototype.hasOwnProperty.call(snapshot.user, "models");
			const invalid = draft !== void 0 && (!validURL(draft.baseURL.trim()) || modelFailure(draft.models) || keyInvalid);
			const patchDraft = (next) => {
				setDraft((current) => current === void 0 ? current : {
					...current,
					...next
				});
				setFailure(void 0);
				setNotice(void 0);
			};
			const patchModel = (index, patch) => {
				if (draft === void 0) return;
				patchDraft({ models: draft.models.map((model, at) => {
					if (at !== index) return model;
					const next = { ...model };
					if (patch.id !== void 0) {
						next.id = patch.id;
						if (next.thinking === true && next.defaultEffort !== void 0 && !isValidEffortForModel(effortRow(next.id, next.thinkingEfforts), next.defaultEffort)) {
							const fallback = resolveEffectiveDefaultEffort({
								...effortRow(next.id, next.thinkingEfforts),
								defaultEffort: next.defaultEffort
							}) ?? resolveEffectiveDefaultEffort(effortRow(next.id, next.thinkingEfforts));
							if (fallback !== void 0) next.defaultEffort = fallback;
							else delete next.defaultEffort;
						}
					}
					if ("name" in patch) {
						if (patch.name === void 0) delete next.name;
						else next.name = patch.name;
					}
					if ("description" in patch) {
						if (patch.description === void 0) delete next.description;
						else next.description = patch.description;
					}
					if (patch.contextWindow !== void 0) next.contextWindow = patch.contextWindow;
					if ("vision" in patch) {
						if (patch.vision === void 0) delete next.vision;
						else next.vision = patch.vision;
					}
					if ("thinking" in patch) {
						if (patch.thinking === void 0) delete next.thinking;
						else next.thinking = patch.thinking;
						if (patch.thinking !== true) delete next.defaultEffort;
						else if (next.defaultEffort === void 0 || !isValidEffortForModel(effortRow(next.id, next.thinkingEfforts), next.defaultEffort)) {
							const fallback = resolveEffectiveDefaultEffort(effortRow(next.id, next.thinkingEfforts));
							if (fallback !== void 0) next.defaultEffort = fallback;
							else delete next.defaultEffort;
						}
					}
					if ("defaultEffort" in patch) {
						if (patch.defaultEffort === void 0) delete next.defaultEffort;
						else next.defaultEffort = patch.defaultEffort;
					}
					return next;
				}) });
			};
			const removeModel = (index) => {
				if (draft === void 0) return;
				patchDraft({ models: draft.models.filter((_, at) => at !== index) });
			};
			const toggleModel = (key) => {
				setExpandedModels((current) => {
					const next = new Set(current);
					if (!next.delete(key)) next.add(key);
					return next;
				});
			};
			const loadUsage = async () => {
				if (props.mode === "detail") return;
				const epoch = ++usageEpoch.current;
				if (peekOpenCodeGoUsageView() === void 0) setUsage({ status: "loading" });
				try {
					if (apiKey.trim().length > 0) {
						await props.storeApiKey(apiKey.trim());
						if (epoch !== usageEpoch.current) return;
						await refreshCredential();
						if (epoch !== usageEpoch.current) return;
					}
					const read = await props.fetchUsage({ ...draft === void 0 ? {} : { baseURL: draft.baseURL.trim() } });
					if (epoch !== usageEpoch.current) return;
					if (read.kind === "ok") {
						setLastUsage(read.usage);
						persistOpenCodeGoUsage(read.usage);
						setUsageUpdatedAt(/* @__PURE__ */ new Date());
					}
					setUsage(read.kind === "ok" ? {
						status: "ready",
						usage: read.usage
					} : read.kind === "needs-restart" ? { status: "needs-restart" } : { status: "unsupported" });
				} catch (error) {
					if (epoch !== usageEpoch.current) return;
					setUsage({
						status: "error",
						message: usageErrorOf(error, t)
					});
				}
			};
			(0, react.useEffect)(() => {
				if (snapshot.status !== "ready") return;
				if (credential?.configured !== true) return;
				loadUsage();
			}, [snapshot.status, credential?.configured]);
			const fetchModels = async () => {
				if (draft === void 0) return;
				const currentModels = draft.models.map(modelSettingsOf);
				const initiallyPicked = new Set(currentModels.map((model) => model.id));
				setFetching(true);
				setFailure(void 0);
				setNotice(void 0);
				props.beginModelPicker(initiallyPicked, (selected) => {
					setDraft((current) => {
						if (current === void 0) return current;
						const currentById = new Map(current.models.map((model) => [model.id.trim(), model]));
						const next = /* @__PURE__ */ new Map();
						for (const candidate of selected) {
							const existing = currentById.get(candidate.id);
							const discovered = modelDraftOf(candidate);
							next.set(candidate.id, existing === void 0 ? discovered : {
								...existing,
								...discovered,
								rowId: existing.rowId
							});
						}
						return {
							...current,
							models: [...next.values()]
						};
					});
					setCatalogOpen(true);
					setFailure(void 0);
					setNotice(void 0);
				});
				try {
					if (apiKey.trim().length > 0) {
						await props.storeApiKey(apiKey.trim());
						await refreshCredential();
					}
					const found = await props.discoverModels({ baseURL: draft.baseURL.trim() });
					if (found.length === 0) {
						const message = t("fetchEmpty");
						props.failModelPicker(message);
						setFailure(message);
						return;
					}
					const foundIds = new Set(found.map((model) => model.id));
					const currentOnly = currentModels.filter((model) => !foundIds.has(model.id));
					props.completeModelPicker([...found, ...currentOnly]);
				} catch (error) {
					const message = messageOf(error, t("requestFailed"));
					props.failModelPicker(message);
					setFailure(message);
				} finally {
					setFetching(false);
				}
			};
			const discard = () => {
				if (source !== void 0) setDraft(structuredClone(source));
				setApiKey("");
				setFailure(void 0);
				setNotice(void 0);
			};
			const save = async () => {
				if (draft === void 0 || snapshot.value === void 0 || sourceRevision === void 0 || invalid) return;
				setBusy(true);
				setFailure(void 0);
				setNotice(void 0);
				try {
					const settings = settingsOf(draft, snapshot.value);
					const accepted = await props.saveConfiguration(settings, sourceRevision, apiKey.trim().length === 0 ? void 0 : apiKey.trim());
					const next = draftOf(accepted.settings);
					setSource(next);
					setDraft(next);
					setSourceRevision(accepted.revision);
					setApiKey("");
					setNotice(t("saved"));
					refreshCredential();
					loadUsage();
				} catch (error) {
					setFailure(messageOf(error, t("requestFailed")));
				} finally {
					setBusy(false);
				}
			};
			let validation;
			if (draft !== void 0 && !validURL(draft.baseURL.trim())) validation = t("invalidBaseURL");
			else if (draft !== void 0 && modelFailure(draft.models)) validation = t("invalidModel");
			else if (keyInvalid) validation = t("invalidApiKey");
			const headerCount = t("summaryModels").replace("{count}", String(draft?.models.length ?? 0));
			const headerStatus = credential?.configured === true ? t("summaryOn") : t("summaryOff");
			const liveQuota = headlineQuota(usage.status === "ready" ? usage : { status: "idle" }, void 0, t) ?? null;
			const withheld = credential?.configured === false || usage.status === "error" || usage.status === "unsupported" || usage.status === "needs-restart";
			const headerQuota = useProviderQuotaCache(OPENCODE_GO_ENTRY_ID, "OpenCode Go", liveQuota, {
				answered: credential !== void 0,
				signedOut: credential?.configured === false,
				withheld
			});
			const modelsList = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SortableList, {
				items: draft?.models ?? [],
				getId: (model) => model.rowId,
				disabled,
				dragLabel: (model, index) => {
					const label = model.id.trim().length > 0 ? model.id.trim() : String(index + 1);
					return t("dragModel") + ": " + label;
				},
				onReorder: (models) => {
					patchDraft({ models });
				},
				renderItem: (model, index) => {
					const key = rowKeyOf(model);
					const expanded = expandedModels.has(key);
					const label = model.id.trim().length > 0 ? model.id.trim() : String(index + 1);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						"data-model-row": label,
						style: modelContentStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: rowInputStyle,
								value: model.id,
								placeholder: t("modelId"),
								"aria-label": t("modelId") + " " + String(index + 1),
								disabled,
								onChange: (event) => {
									patchModel(index, { id: event.target.value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								style: rowInputStyle,
								value: model.name ?? "",
								placeholder: t("modelName"),
								"aria-label": t("modelName") + " " + String(index + 1),
								disabled,
								onChange: (event) => {
									patchModel(index, { name: event.target.value || void 0 });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: iconButtonStyle,
								"aria-label": t("modelDetails") + ": " + label,
								"aria-expanded": expanded,
								title: t("modelDetails"),
								onClick: () => {
									toggleModel(key);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: expanded })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: iconButtonStyle,
								"aria-label": t("remove") + " " + label,
								title: t("remove"),
								disabled,
								onClick: () => {
									removeModel(index);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrash, {})
							}),
							expanded ? modelExtra(model, index) : null
						]
					});
				}
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				style: {
					...buttonStyle,
					alignSelf: "flex-start"
				},
				disabled,
				onClick: () => {
					const model = {
						rowId: newModelRowId(),
						id: "",
						contextWindow: ""
					};
					patchDraft({ models: [...draft?.models ?? [], model] });
					setExpandedModels((current) => new Set(current).add(model.rowId));
				},
				children: t("addModel")
			})] });
			const accountFields = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: fieldStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("apiKey")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						style: inputStyle,
						type: "password",
						"aria-label": t("apiKey"),
						autoComplete: "off",
						value: apiKey,
						placeholder: credential?.configured ? t("apiKeyReplace") : t("apiKeyPlaceholder"),
						disabled: busy || credential?.writable === false,
						onChange: (event) => {
							setApiKey(event.target.value);
							setFailure(void 0);
							setNotice(void 0);
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: apiKey.length > 0 ? t("apiKeyPending") : credential?.configured ? t("summaryOn") : t("apiKeyUnset")
					})
				]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: fieldStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: labelStyle,
						children: t("baseURL")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
						style: inputStyle,
						type: "url",
						"aria-label": t("baseURL"),
						value: draft?.baseURL ?? "",
						disabled,
						onChange: (event) => {
							patchDraft({ baseURL: event.target.value });
						}
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: hintStyle,
						children: t("baseURLHint")
					})
				]
			})] });
			const draftBlock = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				validation === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: errorStyle$1,
					children: validation
				}),
				failure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: errorStyle$1,
					children: failure
				}),
				notice === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: statusStyle$1,
					children: notice
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: actionsStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: buttonStyle,
						disabled: !dirty || busy,
						onClick: discard,
						children: t("discard")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						style: primaryButtonStyle,
						disabled: !dirty || invalid || disabled,
						onClick: () => {
							save();
						},
						children: t(busy ? "saving" : "save")
					})]
				})
			] });
			/** Provider-specific fields for one expanded model row; shared by both layouts. */
			const modelExtra = (model, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "c-extra-grid",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "c-field",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "c-field-label",
							children: t("modelContext")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: "c-input",
							inputMode: "numeric",
							value: model.contextWindow,
							disabled,
							"aria-label": t("modelContext"),
							onChange: (event) => {
								patchModel(index, { contextWindow: event.target.value });
							}
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "c-extra-checks",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: model.vision === true,
							disabled,
							onChange: (event) => {
								patchModel(index, { vision: event.target.checked });
							}
						}), t("vision")] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: model.thinking === true,
							disabled,
							onChange: (event) => {
								patchModel(index, { thinking: event.target.checked });
							}
						}), t("thinking")] })]
					}),
					model.thinking === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: "c-field",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "c-field-label",
							children: t("defaultEffort")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: "c-input",
							value: resolveEffectiveDefaultEffort(model) ?? "",
							disabled,
							onChange: (event) => {
								patchModel(index, { defaultEffort: event.target.value || void 0 });
							},
							"aria-label": t("defaultEffort"),
							children: openCodeGoSupportedEfforts(effortRow(model.id, model.thinkingEfforts)).map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: level,
								children: formatEffortName(level)
							}, level))
						})]
					}) : null
				]
			});
			const SharedDetail = props.template;
			const detailCopy = props.copy;
			if (props.mode === "detail" && SharedDetail !== void 0 && detailCopy !== void 0 && draft !== void 0) {
				const configured = credential?.configured === true;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SharedDetail, {
					name: title,
					role: "llm",
					mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
					copy: detailCopy,
					notice: t("description"),
					account: {
						state: configured ? "configured" : "unconnected",
						label: configured ? t("summaryOn") : t("apiKeyUnset"),
						body: accountFields
					},
					quota: {
						status: props.usage?.status ?? "loading",
						windows: props.usage?.windows ?? [],
						...props.onRefresh === void 0 ? {} : { onRefresh: props.onRefresh }
					},
					models: {
						count: draft.models.length,
						allOpen: catalogOpen,
						onToggleAll: () => {
							setCatalogOpen((value) => !value);
						},
						sorting: modelSorting,
						onToggleSorting: () => {
							setModelSorting((current) => !current);
						},
						sortDisabled: disabled || draft.models.length < 2,
						onChooseFromAccount: () => {
							fetchModels();
						},
						chooseDisabled: fetching || invalid || snapshot.status !== "ready",
						items: draft.models.map((model) => ({
							rowId: model.rowId,
							id: model.id,
							...model.name === void 0 ? {} : { name: model.name }
						})),
						expanded: [...expandedModels],
						onPatch: (rowId, patch) => {
							const index = draft.models.findIndex((model) => model.rowId === rowId);
							if (index >= 0) patchModel(index, patch);
						},
						onRemove: (rowId) => {
							const index = draft.models.findIndex((model) => model.rowId === rowId);
							if (index >= 0) removeModel(index);
						},
						onToggle: (rowId) => {
							toggleModel(rowId);
						},
						onReorder: (rowIds) => {
							const byId = new Map(draft.models.map((model) => [model.rowId, model]));
							const next = rowIds.map((rowId) => byId.get(rowId)).filter((model) => model !== void 0);
							if (next.length === draft.models.length) patchDraft({ models: next });
						},
						onAdd: () => {
							const model = {
								rowId: newModelRowId(),
								id: "",
								contextWindow: ""
							};
							patchDraft({ models: [...draft.models, model] });
							setExpandedModels((current) => new Set(current).add(model.rowId));
						},
						addDisabled: disabled,
						extra: (row) => {
							const index = draft.models.findIndex((model) => model.rowId === row.rowId);
							const model = draft.models[index];
							return index < 0 || model === void 0 ? null : modelExtra(model, index);
						}
					},
					draft: draftBlock
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				"data-provider-card": "",
				"data-provider-role": "llm",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"data-provider-card-header": "",
					"aria-expanded": open,
					"aria-label": t(open ? "collapse" : "expand") + ": " + title,
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title,
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: headerCount,
						status: headerStatus,
						role: "llm",
						...headerQuota === null ? {} : { quota: headerQuota },
						open,
						unsaved: dirty,
						unsavedLabel: t("unsaved")
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: bodyStyle,
					"data-provider-body": "",
					children: [
						snapshot.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle$1,
							children: t("loading")
						}) : null,
						snapshot.status === "ready" && !snapshot.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle$1,
							children: t("readOnly")
						}) : null,
						draft === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								style: sectionStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									style: sectionTitleStyle,
									children: t("connection")
								}), accountFields]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								style: sectionStyle,
								"aria-label": t("usage"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageHeader, {
										title: t("usage"),
										spinning: usage.status === "loading",
										disabled: usage.status === "loading" || snapshot.status !== "ready",
										refreshLabel: t("usageRefresh"),
										busyLabel: t("usageLoading"),
										...usage.status === "error" ? { error: t("usageRefreshFailed") } : {},
										onRefresh: () => {
											loadUsage();
										}
									}),
									(() => {
										if (usage.status === "idle") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: hintStyle,
											children: t("usageIdle")
										});
										if (usage.status === "loading") {
											const known = lastUsage === void 0 ? 2 : Number(lastUsage.session !== void 0) + Number(lastUsage.weekly !== void 0) + Number(lastUsage.monthly !== void 0);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSkeleton, { rows: known > 0 ? known : 2 });
										}
										const bars = usage.status === "ready" ? usage.usage : lastUsage;
										if (bars !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											bars.session === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageSession"),
												window: bars.session,
												t,
												fallbackReset: t("usageResetEveryHours").replace("{count}", "5")
											}),
											bars.weekly === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageWeekly"),
												window: bars.weekly,
												t,
												fallbackReset: t("usageResetEveryDays").replace("{count}", "7")
											}),
											bars.monthly === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageMonthly"),
												window: bars.monthly,
												t,
												fallbackReset: t("usageResetEveryDays").replace("{count}", "30")
											}),
											bars.weekly !== void 0 && bars.weekly.models.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													flexDirection: "column",
													gap: 6
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: labelStyle,
													children: t("usageModels")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
													style: usageListStyle,
													"aria-label": t("usageModels"),
													children: bars.weekly.models.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
														style: {
															display: "flex",
															alignItems: "baseline",
															justifyContent: "space-between",
															gap: 10
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: {
																...hintStyle,
																color: "var(--dsw-alias-label-secondary)",
																overflowWrap: "anywhere"
															},
															children: model.name
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															style: {
																...hintStyle,
																flex: "none"
															},
															children: [
																model.requestCount,
																" ",
																t("usageRequests")
															]
														})]
													}, model.name))
												})]
											}) : null
										] });
										if (usage.status === "unsupported") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: hintStyle,
											children: t("usageUnsupported")
										});
										if (usage.status === "needs-restart") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: hintStyle,
											children: t("usageNeedsRestart")
										});
										if (usage.status === "error") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											style: errorStyle$1,
											children: usage.message
										});
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSkeleton, { rows: 2 });
									})(),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageUpdatedAt, {
										at: usageUpdatedAt,
										label: usageUpdatedAt === void 0 ? "" : t("usageUpdatedAt").replace("{time}", formatUsageClock(usageUpdatedAt))
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								style: sectionStyle,
								"aria-label": t("models"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										gap: 10
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										style: disclosureStyle,
										"aria-expanded": catalogOpen,
										"aria-label": t("models"),
										onClick: () => {
											setCatalogOpen(!catalogOpen);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevron, { open: catalogOpen }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: sectionTitleStyle,
												children: t("models")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: hintStyle,
												children: customModels ? t("customized") : t("inherited")
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: buttonStyle,
										disabled: fetching || invalid || snapshot.status !== "ready",
										onClick: () => {
											fetchModels();
										},
										children: t(fetching ? "fetchingModels" : "fetchModels")
									})]
								}), catalogOpen ? modelsList : null]
							})
						] }),
						draftBlock
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/OpenCodeGoModelPicker.tsx
		/** Frame-level model selection overlay opened by the OpenCode Go settings card. */
		/** Shared observable joining the settings card to its frame-level overlay. */
		var OpenCodeGoModelPickerController = class {
			snapshot = {
				open: false,
				loading: false,
				candidates: [],
				picked: /* @__PURE__ */ new Set()
			};
			listeners = /* @__PURE__ */ new Set();
			onAdopt;
			/** Read the stable snapshot identity until picker state changes. */
			getSnapshot = () => this.snapshot;
			/** Subscribe one renderer listener. */
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/** Open immediately while discovery loads with the current selection captured. */
			begin(onAdopt, initiallyPicked = /* @__PURE__ */ new Set()) {
				this.onAdopt = onAdopt;
				this.publish({
					open: true,
					loading: true,
					candidates: [],
					picked: new Set(initiallyPicked)
				});
			}
			/** Populate an open loading picker, retaining current ids; empty catalogs adopt the live list. */
			complete(candidates) {
				if (!this.snapshot.open || !this.snapshot.loading) return;
				const candidateIds = new Set(candidates.map((model) => model.id));
				const current = this.snapshot.picked;
				const kept = [...current].filter((id) => candidateIds.has(id));
				const picked = current.size === 0 ? new Set(candidateIds) : new Set(kept);
				const fresh = candidates.filter((model) => !current.has(model.id));
				const rest = candidates.filter((model) => current.has(model.id));
				this.publish({
					open: true,
					loading: false,
					candidates: [...fresh, ...rest],
					picked
				});
			}
			/** Keep the open picker visible with a discovery failure. */
			fail(message) {
				if (!this.snapshot.open || !this.snapshot.loading) return;
				this.publish({
					open: true,
					loading: false,
					candidates: [],
					picked: /* @__PURE__ */ new Set(),
					error: message
				});
			}
			/** Close without adopting any candidate. */
			close = () => {
				this.onAdopt = void 0;
				this.publish({
					open: false,
					loading: false,
					candidates: [],
					picked: /* @__PURE__ */ new Set()
				});
			};
			/** Toggle one candidate by id. */
			toggle = (id) => {
				const picked = new Set(this.snapshot.picked);
				if (picked.has(id)) picked.delete(id);
				else picked.add(id);
				this.publish({
					...this.snapshot,
					picked
				});
			};
			/** Close and deliver the selected candidates to the card. */
			adopt = () => {
				if (this.snapshot.loading || this.snapshot.error !== void 0) return;
				const callback = this.onAdopt;
				const selected = this.snapshot.candidates.filter((model) => this.snapshot.picked.has(model.id));
				this.close();
				callback?.(selected);
			};
			publish(snapshot) {
				this.snapshot = snapshot;
				for (const listener of this.listeners) listener();
			}
		};
		const rootStyle = {
			position: "fixed",
			inset: 0,
			zIndex: 1e3,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			boxSizing: "border-box",
			padding: 24
		};
		const maskStyle = {
			position: "absolute",
			inset: 0,
			background: "var(--dsw-alias-bg-mask-1)",
			backdropFilter: "var(--dsw-mask-blur)"
		};
		const dialogStyle = {
			position: "relative",
			zIndex: 1,
			display: "flex",
			flexDirection: "column",
			width: "min(520px, 100%)",
			maxHeight: "min(680px, calc(100vh - 48px))",
			overflow: "hidden",
			border: "1px solid var(--dsw-alias-border-inverted)",
			borderRadius: 24,
			background: "var(--dsw-alias-bg-layer-2)",
			boxShadow: "var(--dsw-shadow-lv3)",
			color: "var(--dsw-alias-label-primary)"
		};
		const headerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
			padding: "22px 14px 12px 24px"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 16,
			lineHeight: "24px",
			fontWeight: 500
		};
		const closeStyle = {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			width: 28,
			height: 28,
			border: 0,
			borderRadius: 8,
			background: "transparent",
			color: "var(--dsw-alias-label-secondary)",
			cursor: "pointer",
			fontSize: 22
		};
		const descriptionStyle = {
			margin: 0,
			padding: "0 24px",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-primary)"
		};
		const listStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			minHeight: 0,
			margin: "20px 24px",
			padding: 0,
			overflowY: "auto",
			listStyle: "none"
		};
		const candidateStyle = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			fontSize: 14,
			lineHeight: "22px",
			cursor: "pointer"
		};
		const statusStyle = {
			display: "flex",
			alignItems: "center",
			minHeight: 96,
			margin: "20px 24px",
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle = {
			...statusStyle,
			color: "var(--dsw-alias-state-error-primary)"
		};
		const footerStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			gap: 8,
			padding: "0 24px 24px"
		};
		const outlineButtonStyle = {
			height: 36,
			padding: "0 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			background: "transparent",
			color: "var(--dsw-alias-label-primary)",
			cursor: "pointer",
			fontSize: 14
		};
		/** Render the OpenCode Go model candidate picker in the frame overlay layer. */
		function OpenCodeGoModelPicker(props) {
			const { t } = props;
			const snapshot = props.useOpenCodeGoModelPicker((value) => value);
			(0, react.useEffect)(() => {
				if (!snapshot.open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") props.closePicker();
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [snapshot.open, props.closePicker]);
			if (!snapshot.open) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: rootStyle,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: maskStyle,
					"aria-hidden": "true",
					onClick: props.closePicker
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: dialogStyle,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": t("pickerTitle"),
					"aria-busy": snapshot.loading,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: headerStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								style: titleStyle,
								children: t("pickerTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: closeStyle,
								"aria-label": t("close"),
								onClick: props.closePicker,
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: descriptionStyle,
							children: t("pickerDescription")
						}),
						snapshot.loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: statusStyle,
							role: "status",
							children: t("pickerLoading")
						}) : snapshot.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							role: "alert",
							children: snapshot.error
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							style: listStyle,
							children: snapshot.candidates.map((model) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: candidateStyle,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: snapshot.picked.has(model.id),
									onChange: () => {
										props.togglePickerModel(model.id);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.name && model.name !== model.id ? model.name + " (" + model.id + ")" : model.name ?? model.id })]
							}) }, model.id))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: footerStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: outlineButtonStyle,
								onClick: props.closePicker,
								children: t("cancel")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: {
									...outlineButtonStyle,
									...snapshot.loading || snapshot.error !== void 0 ? {
										cursor: "not-allowed",
										opacity: .4
									} : {}
								},
								disabled: snapshot.loading || snapshot.error !== void 0,
								onClick: props.adoptPickerModels,
								children: t("applySelected")
							})]
						})
					]
				})]
			}), document.body);
		}
		//#endregion
		//#region src/client/locales.ts
		/** Localized copy for the OpenCode Go Plugin configuration card. */
		/** English OpenCode Go configuration copy. */
		const en = {
			title: "OpenCode Go",
			description: "OpenCode Go API key, endpoint, and model catalog.",
			expand: "Expand settings",
			collapse: "Collapse settings",
			loading: "Loading plugin settings…",
			unavailable: "This profile does not expose OpenCode Go settings.",
			remoteAccess: "Remote browsers cannot edit durable plugin settings: non-loopback pages keep settings process-local even when the authenticated API trusts the browser. Browse the page on the host itself, or forward it first (ssh -L 3080:127.0.0.1:3080 user@host, then open http://127.0.0.1:3080). Settings saved there keep working for remote sessions.",
			readOnly: "This profile’s settings document is read-only.",
			apiKey: "API key",
			apiKeyPlaceholder: "Enter API key",
			apiKeyConfigured: "Configured",
			apiKeyReplace: "Enter a new key to replace the saved key",
			apiKeyPending: "New key entered — Fetch or Refresh stores it, then Host uses the stored credential",
			apiKeyUnset: "No API key configured",
			baseURL: "API URL",
			baseURLHint: "Official OpenCode Go endpoint.",
			connection: "Connection",
			usage: "Account quota",
			usageRefresh: "Refresh",
			usageIdle: "Save an API key to load account quota.",
			usageLoading: "Reading usage…",
			usageSession: "5-hour window",
			usageWeekly: "Weekly window",
			usageMonthly: "Monthly window",
			usageUsed: "Used",
			usageModels: "Models used this week",
			usageRequests: "requests",
			usageUnsupported: "This endpoint does not report cloud usage.",
			usageNeedsRestart: "Usage appears after the running host reloads this plugin (restart dsh).",
			usageUnreachable: "Could not reach OpenCode Go usage. Check the network and API URL.",
			usageRefreshFailed: "Refresh failed",
			usageUpdatedAt: "Updated {time}",
			usageResetAt: "Resets {time}",
			usageResetAtDays: "Usage limits reset on {date} ({count} days left)",
			usageResetEveryHours: "Resets every {count} hours",
			usageResetEveryDays: "Resets every {count} days",
			models: "Model catalog",
			summaryModels: "{count} models",
			summaryOn: "Configured",
			summaryOff: "Not configured",
			modelDetails: "Details",
			dragModel: "Drag to reorder",
			fetchModels: "Fetch available models",
			fetchingModels: "Fetching models…",
			fetchEmpty: "The endpoint returned no models.",
			pickerTitle: "Select model catalog",
			pickerDescription: "Select the models to keep in this catalog.",
			pickerLoading: "Fetching model metadata…",
			applySelected: "Apply selected",
			cancel: "Cancel",
			close: "Close",
			addModel: "Add model manually",
			modelId: "Model ID",
			modelName: "Display name",
			modelContext: "Context window",
			modelOutput: "Maximum output",
			vision: "Vision",
			thinking: "Reasoning",
			tools: "Tools",
			defaultEffort: "Default thinking",
			remove: "Remove",
			inherited: "Using the composed catalog",
			customized: "Custom catalog",
			unsaved: "Unsaved changes",
			discard: "Discard",
			save: "Save",
			saving: "Saving…",
			saved: "Saved",
			invalidBaseURL: "Enter an HTTP or HTTPS API URL.",
			invalidModel: "Every model needs a unique ID and valid positive capacities.",
			invalidApiKey: "The API key cannot contain only whitespace.",
			requestFailed: "Request failed."
		};
		/** Chinese OpenCode Go configuration copy. */
		const zh = {
			title: "OpenCode Go",
			description: "配置 OpenCode Go API 密钥、地址和模型目录。",
			expand: "展开设置",
			collapse: "折叠设置",
			loading: "正在加载插件设置…",
			unavailable: "此 profile 未开放 OpenCode Go 设置。",
			remoteAccess: "远程浏览器无法编辑持久化插件设置：非 loopback 页面只将设置保存在进程内，即使经过认证的 API 信任该浏览器。请在主机本机打开页面，或先做端口转发（ssh -L 3080:127.0.0.1:3080 用户@主机，再访问 http://127.0.0.1:3080）。在主机上保存的配置对远程会话照常生效。",
			readOnly: "此 profile 的设置文件为只读。",
			apiKey: "API 密钥",
			apiKeyPlaceholder: "输入 API 密钥",
			apiKeyConfigured: "已配置",
			apiKeyReplace: "输入新密钥以替换已保存的密钥",
			apiKeyPending: "已输入新密钥——获取模型或刷新用量会先写入凭据，再由 Host 使用",
			apiKeyUnset: "尚未配置 API 密钥",
			baseURL: "API 地址",
			baseURLHint: "OpenCode Go 官方端点。",
			connection: "连接",
			usage: "账户额度",
			usageRefresh: "刷新",
			usageIdle: "保存 API 密钥后会读取账户额度。",
			usageLoading: "正在读取用量…",
			usageSession: "5 小时窗口",
			usageWeekly: "每周额度",
			usageMonthly: "每月额度",
			usageUsed: "已用",
			usageModels: "本周使用模型",
			usageRequests: "次请求",
			usageUnsupported: "该端点不提供云端用量信息。",
			usageNeedsRestart: "运行中的宿主尚未加载用量功能，重启 dsh 后自动显示。",
			usageUnreachable: "无法读取云端用量。请检查网络和 API 地址。",
			usageRefreshFailed: "刷新失败",
			usageUpdatedAt: "{time} 已更新",
			usageResetAt: "重置时间：{time}",
			usageResetAtDays: "重置时间：{date}（还剩 {count} 天）",
			usageResetEveryHours: "每 {count} 小时重置",
			usageResetEveryDays: "每 {count} 天重置",
			models: "模型目录",
			summaryModels: "{count} 个模型",
			summaryOn: "已配置",
			summaryOff: "未配置",
			modelDetails: "详细设置",
			dragModel: "拖动调整顺序",
			fetchModels: "获取可用模型",
			fetchingModels: "正在获取模型…",
			fetchEmpty: "端点没有返回任何模型。",
			pickerTitle: "选择模型目录",
			pickerDescription: "选择要保留在此目录中的模型。",
			pickerLoading: "正在获取模型元数据…",
			applySelected: "应用所选",
			cancel: "取消",
			close: "关闭",
			addModel: "手动添加模型",
			modelId: "模型 ID",
			modelName: "显示名称",
			modelContext: "上下文窗口",
			modelOutput: "最大输出",
			vision: "视觉",
			thinking: "推理",
			tools: "工具调用",
			defaultEffort: "默认思考",
			remove: "删除",
			inherited: "正在使用组合层模型目录",
			customized: "自定义模型目录",
			unsaved: "有未保存更改",
			discard: "放弃更改",
			save: "保存",
			saving: "保存中…",
			saved: "已保存",
			invalidBaseURL: "请输入 HTTP 或 HTTPS API 地址。",
			invalidModel: "每个模型必须有唯一 ID，容量必须为正整数。",
			invalidApiKey: "API 密钥不能只包含空白字符。",
			requestFailed: "请求失败。"
		};
		//#endregion
		//#region src/client/index.ts
		/** Grace period for dsh-llm-providers-ui to register the providers settings section before the missing-owner warning fires. */
		const MISSING_OWNER_GRACE_MS = 15e3;
		/** Stable browser-plugin name. */
		const name = "dsh-llm-opencode-go-client";
		/** Client services required by the Plugin configuration contribution. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"configForms"
		];
		/** Register localized OpenCode Go configuration under Plugin configuration. */
		function apply(ctx) {
			const localeNamespace = "settings.opencode-go";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-llm-opencode-go: Plugin configuration copy");
			const t = ctx.locale.bind(localeNamespace);
			let closed = false;
			const openCodeGoSettings = ctx.configForms.get(OPENCODE_GO_ENTRY_ID);
			const picker = new OpenCodeGoModelPickerController();
			const account = { state: "unknown" };
			let accountEpoch = 0;
			const publishAccount = (state) => {
				if (closed || account.state === state) return;
				account.state = state;
				try {
					ctx.get("providerDirectory")?.update(OPENCODE_GO_ENTRY_ID);
				} catch {}
			};
			const { rpc } = ctx.reflect.get("connection");
			const describeCredential = async () => {
				const epoch = accountEpoch;
				const result = await callPlugin(OPENCODE_GO_CREDENTIAL_STATUS_ENDPOINT, {});
				if (!result.ok) throw new Error(result.error.message);
				const credential = result.value;
				if (typeof credential.configured !== "boolean" || typeof credential.writable !== "boolean") throw new Error(t("requestFailed"));
				if (epoch === accountEpoch) publishAccount(credential.configured ? "configured" : "unconnected");
				return {
					configured: credential.configured,
					writable: credential.writable
				};
			};
			const callPlugin = async (endpoint, payload) => {
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, 2e4);
				try {
					return await rpc.call("/api", OPENCODE_GO_RPC_ENDPOINT, {
						endpoint,
						payload
					}, controller.signal);
				} catch (error) {
					if (controller.signal.aborted) throw new Error(t("requestFailed"));
					throw error;
				} finally {
					clearTimeout(timer);
				}
			};
			const saveConfiguration = async (settings, sourceRevision, apiKey) => {
				const source = openCodeGoSettings.getSnapshot();
				if (source.status !== "ready" || source.value === void 0 || source.revision !== sourceRevision || !source.writable) throw new Error(t("requestFailed"));
				if (apiKey !== void 0) await storeApiKey(apiKey);
				const current = openCodeGoSettings.getSnapshot();
				if (current.status !== "ready" || current.value === void 0 || current.revision !== sourceRevision || !current.writable) throw new Error(t("requestFailed"));
				const ops = [];
				if (current.value.baseURL !== settings.baseURL) ops.push({
					op: "set",
					path: ["baseURL"],
					value: settings.baseURL
				});
				if (JSON.stringify(current.value.models) !== JSON.stringify(settings.models)) {
					const models = JSON.parse(JSON.stringify(settings.models));
					ops.push({
						op: "set",
						path: ["models"],
						value: models
					});
				}
				if (ops.length > 0) {
					const checked = await callPlugin(OPENCODE_GO_VALIDATE_ENDPOINT, {
						baseURL: settings.baseURL,
						models: settings.models
					});
					if (!checked.ok) throw new Error(checked.error.message);
					const latest = openCodeGoSettings.getSnapshot();
					if (latest.status !== "ready" || latest.value === void 0 || latest.revision !== sourceRevision || !latest.writable) throw new Error(t("requestFailed"));
					if (!await openCodeGoSettings.mutate(ops, sourceRevision)) throw new Error(t("requestFailed"));
				}
				const accepted = openCodeGoSettings.getSnapshot();
				if (accepted.value === void 0 || accepted.revision === void 0) throw new Error(t("requestFailed"));
				return {
					settings: accepted.value,
					revision: accepted.revision
				};
			};
			const storeApiKey = async (value) => {
				if (value.trim().length === 0) throw new Error(t("invalidApiKey"));
				const result = await callPlugin(OPENCODE_GO_CREDENTIAL_SET_ENDPOINT, { apiKey: value });
				if (!result.ok) throw new Error(result.error.message);
				ctx.get("providerDirectory")?.invalidateUsage(OPENCODE_GO_ENTRY_ID);
				const credential = result.value;
				if (typeof credential.configured === "boolean") {
					accountEpoch += 1;
					publishAccount(credential.configured ? "configured" : "unconnected");
				}
			};
			const fetchUsage = async (request) => {
				const result = await callPlugin(OPENCODE_GO_USAGE_ENDPOINT, request);
				if (!result.ok) {
					if (result.error.message.startsWith("unknown OpenCode Go endpoint")) return { kind: "needs-restart" };
					throw new Error(result.error.message);
				}
				const reply = decodeOpenCodeGoUsageReply(result.value);
				if (reply === void 0) throw new Error("OpenCode Go returned an invalid usage snapshot");
				return reply.status === "ok" ? {
					kind: "ok",
					usage: reply.usage
				} : { kind: "unsupported" };
			};
			const discoverModels = async (request) => {
				const result = await callPlugin(OPENCODE_GO_DISCOVER_ENDPOINT, request);
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeOpenCodeGoDiscoveryResult(result.value);
				if (decoded === void 0) throw new Error("OpenCode Go returned an invalid model catalog");
				return decoded.models;
			};
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "opencode-go-model-picker",
				order: 100,
				inject: () => ({
					t,
					hooks: { openCodeGoModelPicker: picker },
					closePicker: picker.close,
					togglePickerModel: picker.toggle,
					adoptPickerModels: picker.adopt
				})
			}, OpenCodeGoModelPicker));
			ctx.slots.inject("settings.provider.item", () => ctx.slots.register({
				name: "settings.provider.item",
				key: OPENCODE_GO_ENTRY_ID,
				locale: localeNamespace,
				inject: () => ({
					t,
					hooks: { openCodeGoSettings },
					describeCredential,
					storeApiKey,
					saveConfiguration,
					discoverModels,
					fetchUsage,
					beginModelPicker: (initiallyPicked, onAdopt) => {
						picker.begin(onAdopt, initiallyPicked);
					},
					completeModelPicker: (candidates) => {
						picker.complete(candidates);
					},
					failModelPicker: (message) => {
						picker.fail(message);
					},
					closeModelPicker: picker.close
				})
			}, OpenCodeGoPluginCard));
			ctx.inject(["providerDirectory"], (directoryScope) => {
				const directory = directoryScope.providerDirectory;
				if (directory === void 0) return;
				directoryScope.effect(() => {
					const declaration = Object.assign({
						key: OPENCODE_GO_ENTRY_ID,
						name: "OpenCode Go",
						role: "llm",
						header: "shared",
						detail: "shared",
						usage: createOpenCodeGoUsageReader(),
						modelCount: () => openCodeGoSettings.getSnapshot().value?.models?.length
					}, {
						catalogId: "opencode-go",
						account: () => ({ state: account.state })
					});
					return directory.register(declaration);
				}, "dsh-llm-opencode-go: provider directory");
			});
			ctx.effect(() => {
				Promise.resolve().then(describeCredential).catch(() => void 0);
				return () => {
					closed = true;
				};
			}, "dsh-llm-opencode-go: account snapshot");
			ctx.effect(() => {
				let warned = false;
				const hasProvidersSection = () => ctx.slots.entries("settings.section").some((entry) => entry.options.id === "providers");
				const check = () => {
					if (hasProvidersSection() || warned) return;
					warned = true;
					console.warn("[dsh-llm-providers-ui] LLM Providers page missing for card llm-opencode-go: install dsh-llm-providers-ui to show the card. Host route remains active.");
				};
				const timer = setTimeout(check, MISSING_OWNER_GRACE_MS);
				const stop = ctx.slots.subscribe("settings.section", () => {
					if (!hasProvidersSection()) return;
					clearTimeout(timer);
					stop();
				});
				return () => {
					clearTimeout(timer);
					stop();
				};
			}, "dsh-llm-providers-ui: missing owner diagnostic");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
