window.__ModuleLoader__.load({
	id: "dsh-llm-opencode-go",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
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
		/** Settings namespace owned by the OpenCode Go plugin. */
		const OPENCODE_GO_SETTINGS_NAMESPACE = "llm-opencode-go";
		/** Private Connection RPC channel used by this package's two runtime faces. */
		const OPENCODE_GO_RPC_CHANNEL = "/opencode-go";
		/** Rich model-discovery endpoint inside {@link OPENCODE_GO_RPC_CHANNEL}. */
		const OPENCODE_GO_DISCOVER_ENDPOINT = "models/discover";
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
		//#region src/client/provider-chrome.tsx
		const LABELS = /* @__PURE__ */ new Set([
			"LLM 供应商",
			"LLM Providers",
			"供应商",
			"Providers"
		]);
		const MARK = "data-dsh-providers-icon";
		const REFRESH_PATH = "M1.272 6.21348C1.70645 3.08888 4.59169 0.908064 7.71634 1.34239C8.95495 1.51469 10.0438 2.07331 10.8814 2.87755L11.9458 1.81407C12.1347 1.6255 12.4572 1.75911 12.4575 2.02598V5.08751C12.4574 5.25303 12.3233 5.38731 12.1577 5.38731H9.0972C8.82993 5.38731 8.69629 5.06361 8.88528 4.87462L10.0327 3.72618C9.3732 3.09994 8.52006 2.66569 7.5513 2.53087C5.08313 2.18779 2.80376 3.91044 2.46048 6.37852C2.11747 8.84665 3.84009 11.1261 6.30814 11.4693C8.77612 11.8121 11.0557 10.0896 11.399 7.62169L11.9937 7.70372L12.5874 7.78673C12.153 10.9112 9.26756 13.0919 6.1431 12.6578C3.01854 12.2234 0.837738 9.33809 1.272 6.21348Z";
		const NAV = "<path fill-rule=\"evenodd\" clip-rule=\"evenodd\" fill=\"currentColor\" d=\"M7.00018 0.353516C10.6708 0.353535 13.6468 3.32958 13.6469 7.00018C13.6468 10.6708 10.6708 13.6468 7.00018 13.6469C3.32957 13.6468 0.353535 10.6708 0.353516 7.00018C0.353535 3.32957 3.32957 0.353531 7.00018 0.353516ZM5.44643 7.59661C5.49463 8.97506 5.70762 10.191 6.02136 11.0793C6.20141 11.5891 6.40328 11.9585 6.59898 12.1889C6.79501 12.4196 6.93213 12.454 7.00018 12.454C7.06822 12.454 7.20533 12.4197 7.40138 12.1889C7.59708 11.9585 7.79895 11.589 7.979 11.0793C8.29274 10.191 8.50574 8.97506 8.55394 7.59661H5.44643ZM1.57861 7.59661C1.80785 9.70467 3.2386 11.4509 5.1715 12.1388C5.07135 11.9317 4.97972 11.7098 4.89746 11.477C4.53084 10.4391 4.30224 9.0828 4.25357 7.59661H1.57861ZM9.74679 7.59661C9.69813 9.0828 9.46952 10.4391 9.1029 11.477C9.0206 11.7099 8.92818 11.9316 8.82797 12.1388C10.7613 11.4511 12.1925 9.70496 12.4218 7.59661H9.74679ZM5.1706 1.8616C3.23814 2.54963 1.80876 4.29604 1.5795 6.40376H4.25357C4.30224 4.91756 4.53083 3.56129 4.89746 2.5234C4.97968 2.29066 5.07051 2.0686 5.1706 1.8616ZM7.00018 1.54637C6.93213 1.54638 6.79503 1.5807 6.59898 1.81145C6.40332 2.04177 6.20139 2.41058 6.02136 2.92012C5.70754 3.80851 5.49461 5.02499 5.44643 6.40376H8.55394C8.50575 5.025 8.29282 3.80851 7.979 2.92012C7.79898 2.41059 7.59705 2.04177 7.40138 1.81145C7.20531 1.58067 7.06823 1.54637 7.00018 1.54637ZM8.82887 1.8616C8.92902 2.0687 9.02064 2.29053 9.1029 2.5234C9.46953 3.56129 9.69812 4.91756 9.74679 6.40376H12.4209C12.1916 4.29575 10.7618 2.54943 8.82887 1.8616Z\"/>";
		function patchNav() {
			if (typeof document === "undefined") return;
			for (const button of document.querySelectorAll("nav button")) {
				if ([...button.querySelectorAll("span")].find((span) => LABELS.has(span.textContent?.trim() ?? "")) === void 0) continue;
				const svg = button.querySelector("svg");
				if (svg === null || svg.getAttribute(MARK) === "globe") continue;
				svg.setAttribute(MARK, "globe");
				svg.setAttribute("viewBox", "0 0 14 14");
				svg.setAttribute("fill", "none");
				svg.innerHTML = NAV;
			}
		}
		/** Use the official 14px globe glyph on the LLM 供应商 nav row. */
		function installProvidersNavIcon() {
			if (typeof document === "undefined" || document.body === null) return () => {};
			ensureMotionStyles();
			let scheduled = false;
			let frame = 0;
			const flush = () => {
				scheduled = false;
				frame = 0;
				patchNav();
			};
			const observer = new MutationObserver(() => {
				if (scheduled) return;
				scheduled = true;
				frame = requestAnimationFrame(flush);
			});
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			patchNav();
			return () => {
				observer.disconnect();
				if (frame !== 0) cancelAnimationFrame(frame);
				frame = 0;
				scheduled = false;
			};
		}
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
			const locale = typeof locales === "string" ? locales : locales?.[0] ?? (typeof navigator === "undefined" ? void 0 : navigator.language);
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
		/** Official-style reset caption under a usage bar. */
		function UsageResetAt(props) {
			if (props.label === void 0 || props.label.length === 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				style: {
					margin: 0,
					fontSize: 12,
					lineHeight: "18px",
					color: "var(--dsw-alias-label-tertiary)"
				},
				children: props.label
			});
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
			minHeight: 68,
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
		/** Join connection status and model count: "已登录 · 8 个模型". */
		function formatProviderSummary(status, modelsLabel) {
			return status.replace(/[。.]$/u, "") + " · " + modelsLabel;
		}
		/** Fixed-height collapsed header: mark, title, status · count, chevron. */
		function ProviderCardHeader(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				style: {
					display: "flex",
					minWidth: 0,
					flex: 1,
					flexDirection: "column",
					gap: 4
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						fontSize: 14,
						fontWeight: 600,
						lineHeight: 1
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							width: 18,
							height: 18,
							flex: "none",
							display: "block",
							overflow: "visible"
						},
						children: props.mark
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: { lineHeight: "20px" },
						children: props.title
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					style: {
						fontSize: 13,
						lineHeight: "18px",
						color: "var(--dsw-alias-label-tertiary)",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: props.summary
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
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
					"aria-hidden": "true",
					style: {
						fontSize: 18,
						transform: props.open ? "rotate(180deg)" : "none"
					},
					children: "⌄"
				})]
			})] });
		}
		//#endregion
		//#region src/client/ProvidersSection.tsx
		/** Settings > 供应商 page shell. Provider cards arrive through settings.provider.item. */
		const pageStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 16,
			width: "100%"
		};
		const titleStyle$1 = {
			margin: 0,
			color: "var(--dsw-alias-label-primary)",
			fontSize: 16,
			fontWeight: 500,
			lineHeight: "24px"
		};
		const subtitleStyle = {
			margin: "4px 0 0",
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		const listStyle$2 = {
			display: "flex",
			flexDirection: "column",
			gap: 12
		};
		const emptyStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 13,
			lineHeight: "20px"
		};
		/** Stable known order, then any keyed card the owner did not know about. */
		function orderedProviderItemKeys(registeredKeys = []) {
			const registered = [...new Set(registeredKeys.filter((key) => key.length > 0))];
			if (registered.length === 0) return [...PROVIDER_ITEM_ORDER];
			const preferred = PROVIDER_ITEM_ORDER.filter((key) => registered.includes(key));
			const extra = registered.filter((key) => !PROVIDER_ITEM_ORDER.includes(key));
			return [...preferred, ...extra];
		}
		/** Bind the shared page to the live keyed-slot ledger so new plugins appear without a whitelist bump. */
		function bindProvidersSection(listRegisteredKeys, subscribe) {
			return function BoundProvidersSection(props) {
				const [, bump] = (0, react.useState)(0);
				(0, react.useEffect)(() => subscribe?.(() => bump((n) => n + 1)) ?? (() => {}), [subscribe, listRegisteredKeys]);
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProvidersSection, {
					...props,
					registeredKeys: listRegisteredKeys()
				});
			};
		}
		/** Render installed provider cards. Unknown plugins append after the preferred order. */
		function ProvidersSection(props) {
			const t = props.t ?? ((key) => key);
			const renderSlot = props.renderSlot;
			const items = orderedProviderItemKeys(props.registeredKeys).map((key) => {
				const node = renderSlot?.(PROVIDERS_ITEM_SLOT, {}, { entryKey: key });
				return node == null ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: node }, key);
			}).filter(Boolean);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				"data-providers-section": PROVIDERS_LOCALE_NS,
				style: pageStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
					style: titleStyle$1,
					children: t("title")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: subtitleStyle,
					children: t("subtitle")
				})] }), items.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: listStyle$2,
					children: items
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					style: emptyStyle,
					children: t("empty")
				})]
			});
		}
		//#endregion
		//#region src/client/provider-section.ts
		const PROVIDERS_SECTION_ID = "providers";
		const PROVIDERS_ITEM_SLOT = "settings.provider.item";
		const PROVIDERS_LOCALE_NS = "settings.providers";
		/** Display order for installed provider cards. Absent plugins render nothing. */
		const PROVIDER_ITEM_ORDER = [
			"llm-cursor",
			"llm-grok",
			"llm-codex",
			"llm-ollama",
			"llm-commandcode",
			"llm-opencode-go"
		];
		const copy = {
			zh: {
				nav: "LLM 供应商",
				title: "LLM 供应商",
				subtitle: "连接账号，并选择哪些模型出现在对话的模型列表里。",
				empty: "安装 Cursor、Grok、Codex 或 OpenCode Go 后，在这里连接账号并选择模型。"
			},
			en: {
				nav: "LLM Providers",
				title: "LLM Providers",
				subtitle: "Connect accounts and choose which models appear in the chat picker.",
				empty: "Install Cursor, Grok, Codex, or OpenCode Go to connect an account and pick models here."
			}
		};
		function isOccupied(slots) {
			return slots.entries("settings.section").some((entry) => entry.options.id === PROVIDERS_SECTION_ID);
		}
		function duplicateSection(error) {
			return error instanceof Error && /already has|requires options/.test(error.message);
		}
		/**
		* Register the shared LLM 供应商 section when missing. Uninstalling every
		* provider plugin drops the nav row because only they call this helper.
		* @param ctx - browser plugin context (slots + locale).
		*/
		function ensureProviderSection(ctx) {
			const slots = ctx.slots;
			const locale = ctx.locale;
			ctx.slots.inject("settings.section", () => {
				let disposeSection;
				let disposeLocale;
				let disposeIcon;
				const claim = () => {
					if (disposeSection !== void 0 || isOccupied(slots)) return;
					disposeLocale ??= locale.register(PROVIDERS_LOCALE_NS, copy);
					const t = locale.bind(PROVIDERS_LOCALE_NS);
					try {
						disposeSection = slots.register({
							name: "settings.section",
							id: PROVIDERS_SECTION_ID,
							order: 12,
							label: () => t("nav"),
							locale: PROVIDERS_LOCALE_NS,
							children: { [PROVIDERS_ITEM_SLOT]: {
								kind: "keyed",
								scope: "root"
							} }
						}, bindProvidersSection(() => slots.entries(PROVIDERS_ITEM_SLOT).map((entry) => entry.options.key).filter((key) => typeof key === "string" && key.length > 0), (listener) => slots.subscribe?.(PROVIDERS_ITEM_SLOT, listener)));
						disposeIcon ??= installProvidersNavIcon();
					} catch (error) {
						if (!duplicateSection(error)) throw error;
					}
				};
				claim();
				const stop = slots.subscribe?.("settings.section", () => {
					if (!isOccupied(slots)) {
						disposeSection = void 0;
						claim();
					}
				});
				return () => {
					stop?.();
					disposeIcon?.();
					disposeIcon = void 0;
					disposeSection?.();
					disposeSection = void 0;
					disposeLocale?.();
					disposeLocale = void 0;
				};
			});
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
		//#region src/client/SortableList.tsx
		/** Pointer-driven sortable list with a floating ghost and animated live preview. */
		const listStyle$1 = {
			display: "flex",
			flexDirection: "column",
			gap: 8
		};
		const rowStyle$1 = {
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
			border: 0,
			borderRight: "1px solid var(--dsw-alias-border-l2)",
			padding: 0,
			touchAction: "none",
			userSelect: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const ghostStyle = {
			...rowStyle$1,
			position: "fixed",
			zIndex: 1e4,
			pointerEvents: "none",
			opacity: .96,
			boxShadow: "var(--dsw-shadow-lv2, 0 10px 30px rgba(0, 0, 0, 0.18))",
			outline: "2px solid color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)"
		};
		/** Grip glyph marking one row's pointer handle. */
		function IconGrip() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "10",
				height: "14",
				viewBox: "0 0 10 14",
				fill: "currentColor",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "2.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "2.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "7",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "7",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "2.5",
						cy: "11.5",
						r: "1.2"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "7.5",
						cy: "11.5",
						r: "1.2"
					})
				]
			});
		}
		/**
		* A small dependency-free sortable surface adapted from CodexHub's
		* SortableList: pointer movement drives a portal ghost and a preview array,
		* while FLIP animations move sibling rows into their prospective positions.
		*/
		function SortableList({ items, getId, renderItem, dragLabel, onReorder, disabled = false }) {
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
				style.textContent = "html.opencode-go-sortable-dragging, html.opencode-go-sortable-dragging * { cursor: grabbing !important; user-select: none !important; }";
				const previousRootCursor = document.documentElement.style.cursor;
				const previousBodyCursor = document.body.style.cursor;
				document.head.appendChild(style);
				document.documentElement.classList.add("opencode-go-sortable-dragging");
				document.documentElement.style.cursor = "grabbing";
				document.body.style.cursor = "grabbing";
				return () => {
					document.documentElement.classList.remove("opencode-go-sortable-dragging");
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
				if (disabled || event.button !== 0) return;
				const row = event.currentTarget.closest("[data-sortable-row=\"true\"]");
				if (!(row instanceof HTMLElement)) return;
				event.preventDefault();
				event.currentTarget.focus();
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: listStyle$1,
				children: [renderedItems.map((item, index) => {
					const id = getId(item);
					const dragging = draggedId === id;
					const targeted = dropTargetId === id && draggedId !== id;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: (node) => {
							setRowRef(id, node);
						},
						"data-sortable-row": "true",
						style: {
							...rowStyle$1,
							visibility: dragging ? "hidden" : "visible",
							pointerEvents: dragging ? "none" : "auto",
							borderColor: dragging ? "transparent" : "var(--dsw-alias-border-l2)",
							boxShadow: targeted ? "0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 20%, transparent)" : "none"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							style: {
								...handleStyle,
								cursor: disabled ? "default" : draggedId === null ? "grab" : "grabbing"
							},
							"aria-label": dragLabel(item, index),
							"aria-grabbed": dragging,
							title: dragLabel(item, index),
							disabled,
							onDragStart: (event) => {
								event.preventDefault();
							},
							onPointerDown: (event) => {
								startDrag(event, id);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGrip, {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: { minWidth: 0 },
							children: renderItem(item, index)
						})]
					}, id);
				}), dragGhost !== null && draggedItem !== void 0 ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					"data-sortable-ghost": "true",
					style: {
						...ghostStyle,
						left: dragGhost.x,
						top: dragGhost.y,
						width: dragGhost.width,
						minHeight: dragGhost.height
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: {
							...handleStyle,
							cursor: "grabbing"
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGrip, {})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: { minWidth: 0 },
						children: renderItem(draggedItem, renderedItems.findIndex((item) => getId(item) === draggedId))
					})]
				}), document.body) : null]
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
		const rowStyle = {
			display: "grid",
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			gap: 10
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
		const modelContentStyle = {
			display: "grid",
			gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto auto",
			alignItems: "center",
			gap: 6,
			padding: "6px 8px"
		};
		const modelDetailStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			padding: "10px 4px 4px"
		};
		const capabilitiesStyle = {
			display: "flex",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 14
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
		const barTrackStyle = {
			boxSizing: "border-box",
			height: 14,
			display: "flex",
			overflow: "hidden",
			borderRadius: 999,
			background: "color-mix(in srgb, var(--dsw-alias-label-primary) 14%, transparent)"
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
		function integerOf(text) {
			if (text.trim().length === 0) return void 0;
			const value = Number(text);
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
		function Capability({ label, checked, disabled, onChange }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				style: {
					...labelStyle,
					display: "inline-flex",
					alignItems: "center",
					gap: 6
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked,
					disabled,
					onChange: (event) => {
						onChange(event.target.checked);
					}
				}), label]
			});
		}
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
		/** One quota window: an aggregate consumed percentage and solid meter. */
		function UsageBar({ label, usedText, window: quota, t, fallbackReset }) {
			const percent = Math.round(quota.usage * 1e3) / 10;
			const fill = Math.min(100, Math.max(0, percent));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 6
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: 10
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: labelStyle,
							children: label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: hintStyle,
							children: [
								usedText,
								" ",
								percent,
								"%"
							]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: barTrackStyle,
						role: "progressbar",
						"aria-label": label,
						"aria-valuemin": 0,
						"aria-valuemax": 100,
						"aria-valuenow": Math.round(fill),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							"data-usage-fill": "true",
							style: {
								width: String(fill) + "%",
								height: "100%",
								flex: "none",
								background: "var(--dsw-alias-state-business-primary)",
								transition: "width 200ms ease"
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageResetAt, { label: resetLabelOf(quota.resetsAt, usageResetCopy(t)) ?? fallbackReset })
				]
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
			const [usage, setUsage] = (0, react.useState)({ status: "idle" });
			const [lastUsage, setLastUsage] = (0, react.useState)(void 0);
			const [usageUpdatedAt, setUsageUpdatedAt] = (0, react.useState)(void 0);
			const [catalogOpen, setCatalogOpen] = (0, react.useState)(false);
			const [expandedModels, setExpandedModels] = (0, react.useState)(/* @__PURE__ */ new Set());
			const dirty = source !== void 0 && draft !== void 0 && (!sameDraft(source, draft) || apiKey.length > 0);
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
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					"aria-label": t(open ? "collapse" : "expand") + ": " + t("title"),
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title: t("title"),
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: formatProviderSummary(t("summaryOff"), t("summaryModels").replace("{count}", "0")),
						open
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: bodyStyle,
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
					if (patch.id !== void 0) next.id = patch.id;
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
				setUsage({ status: "loading" });
				try {
					if (apiKey.trim().length > 0) {
						await props.storeApiKey(apiKey.trim());
						await refreshCredential();
					}
					const read = await props.fetchUsage({ ...draft === void 0 ? {} : { baseURL: draft.baseURL.trim() } });
					if (read.kind === "ok") {
						setLastUsage(read.usage);
						setUsageUpdatedAt(/* @__PURE__ */ new Date());
					}
					setUsage(read.kind === "ok" ? {
						status: "ready",
						usage: read.usage
					} : read.kind === "needs-restart" ? { status: "needs-restart" } : { status: "unsupported" });
				} catch (error) {
					setUsage({
						status: "error",
						message: usageErrorOf(error, t)
					});
				}
			};
			(0, react.useEffect)(() => {
				if (!open || snapshot.status !== "ready") return;
				if (credential?.configured !== true && apiKey.trim().length === 0) {
					setUsage({ status: "idle" });
					return;
				}
				loadUsage();
			}, [
				open,
				snapshot.status,
				credential?.configured
			]);
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
				if (draft === void 0 || snapshot.value === void 0 || invalid) return;
				setBusy(true);
				setFailure(void 0);
				setNotice(void 0);
				try {
					const settings = settingsOf(draft, snapshot.value);
					const accepted = await props.saveConfiguration(settings, apiKey.trim().length === 0 ? void 0 : apiKey.trim());
					const next = draftOf(accepted.settings);
					setSource(next);
					setDraft(next);
					setSourceRevision(accepted.revision);
					setApiKey("");
					setNotice(t("saved"));
					await refreshCredential();
					setUsage({ status: "idle" });
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
			const headerSummary = formatProviderSummary(credential?.configured === true ? t("summaryOn") : t("summaryOff"), t("summaryModels").replace("{count}", String(draft?.models.length ?? 0)));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardStyle,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					style: headerStyle$1,
					"aria-expanded": open,
					"aria-label": t(open ? "collapse" : "expand") + ": " + title,
					onClick: () => {
						setOpen(!open);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProviderCardHeader, {
						title,
						mark: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {}),
						summary: headerSummary,
						open,
						unsaved: dirty,
						unsavedLabel: t("unsaved")
					})
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: bodyStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: hintStyle,
							children: t("description")
						}),
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
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										style: sectionTitleStyle,
										children: t("connection")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
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
												placeholder: credential?.configured ? t("apiKeyConfigured") : t("apiKeyPlaceholder"),
												disabled: busy || credential?.writable === false,
												onChange: (event) => {
													setApiKey(event.target.value);
													setFailure(void 0);
													setNotice(void 0);
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: hintStyle,
												children: apiKey.length > 0 ? t("apiKeyPending") : credential?.configured ? t("apiKeyConfigured") : t("apiKeyUnset")
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: fieldStyle,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											style: labelStyle,
											children: t("baseURL")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											style: inputStyle,
											type: "url",
											"aria-label": t("baseURL"),
											value: draft.baseURL,
											disabled,
											onChange: (event) => {
												patchDraft({ baseURL: event.target.value });
											}
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								style: sectionStyle,
								"aria-label": t("usage"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageHeader, {
										title: t("usage"),
										spinning: usage.status === "loading" || usage.status === "idle",
										disabled: usage.status === "loading" || snapshot.status !== "ready",
										refreshLabel: t("usageRefresh"),
										busyLabel: t("usageLoading"),
										...usage.status === "error" ? { error: t("usageRefreshFailed") } : {},
										onRefresh: () => {
											loadUsage();
										}
									}),
									(() => {
										if (usage.status === "loading" || usage.status === "idle") {
											const known = lastUsage === void 0 ? 2 : Number(lastUsage.session !== void 0) + Number(lastUsage.weekly !== void 0) + Number(lastUsage.monthly !== void 0);
											return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageSkeleton, { rows: known > 0 ? known : 2 });
										}
										const bars = usage.status === "ready" ? usage.usage : lastUsage;
										if (bars !== void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
											bars.session === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageSession"),
												usedText: t("usageUsed"),
												window: bars.session,
												t,
												fallbackReset: t("usageResetEveryHours").replace("{count}", "5")
											}),
											bars.weekly === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageWeekly"),
												usedText: t("usageUsed"),
												window: bars.weekly,
												t,
												fallbackReset: t("usageResetEveryDays").replace("{count}", "7")
											}),
											bars.monthly === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageBar, {
												label: t("usageMonthly"),
												usedText: t("usageUsed"),
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
								}), catalogOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SortableList, {
									items: draft.models,
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
												expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														...modelDetailStyle,
														gridColumn: "1 / -1"
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: rowStyle,
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
															style: fieldStyle,
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																style: labelStyle,
																children: t("modelContext")
															}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																style: inputStyle,
																inputMode: "numeric",
																value: model.contextWindow,
																disabled,
																"aria-label": t("modelContext"),
																onChange: (event) => {
																	patchModel(index, { contextWindow: event.target.value });
																}
															})]
														})
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: capabilitiesStyle,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
															label: t("vision"),
															checked: model.vision === true,
															disabled,
															onChange: (vision) => {
																patchModel(index, { vision });
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Capability, {
															label: t("thinking"),
															checked: model.thinking === true,
															disabled,
															onChange: (thinking) => {
																patchModel(index, { thinking });
															}
														})]
													})]
												}) : null
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
										patchDraft({ models: [...draft.models, model] });
										setExpandedModels((current) => new Set(current).add(model.rowId));
									},
									children: t("addModel")
								})] }) : null]
							})
						] }),
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
			/** Populate an open loading picker, retaining only current ids present in the result. */
			complete(candidates) {
				if (!this.snapshot.open || !this.snapshot.loading) return;
				const candidateIds = new Set(candidates.map((model) => model.id));
				this.publish({
					open: true,
					loading: false,
					candidates: [...candidates],
					picked: new Set([...this.snapshot.picked].filter((id) => candidateIds.has(id)))
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
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: model.id })]
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
			remoteAccess: "Remote browsers cannot edit plugin settings: the Harness configuration API is loopback-only. Browse the page on the host itself, or forward it first (ssh -L 3080:127.0.0.1:3080 user@host, then open http://127.0.0.1:3080). Settings saved there keep working for remote sessions.",
			readOnly: "This profile’s settings document is read-only.",
			apiKey: "API key",
			apiKeyPlaceholder: "Enter API key",
			apiKeyConfigured: "Configured — enter a new value to replace it",
			apiKeyPending: "New key entered — Fetch or Refresh stores it, then Host uses the stored credential",
			apiKeyUnset: "No API key configured",
			baseURL: "API URL",
			connection: "Connection",
			usage: "Subscription usage",
			usageRefresh: "Refresh",
			usageLoading: "Reading usage…",
			usageSession: "5-hour usage",
			usageWeekly: "Weekly usage",
			usageMonthly: "Monthly usage",
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
			remoteAccess: "远程浏览器无法编辑插件设置：Harness 配置 API 仅限 loopback。请在主机本机打开页面，或先做端口转发（ssh -L 3080:127.0.0.1:3080 用户@主机，再访问 http://127.0.0.1:3080）。在主机上保存的配置对远程会话照常生效。",
			readOnly: "此 profile 的设置文件为只读。",
			apiKey: "API 密钥",
			apiKeyPlaceholder: "输入 API 密钥",
			apiKeyConfigured: "已配置——输入新值可替换",
			apiKeyPending: "已输入新密钥——获取模型或刷新用量会先写入凭据，再由 Host 使用",
			apiKeyUnset: "尚未配置 API 密钥",
			baseURL: "API 地址",
			connection: "连接",
			usage: "订阅用量",
			usageRefresh: "刷新",
			usageLoading: "正在读取用量…",
			usageSession: "5 小时用量",
			usageWeekly: "每周用量",
			usageMonthly: "每月用量",
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
		/** Stable browser-plugin name. */
		const name = "dsh-llm-opencode-go-client";
		/** Client services required by the Plugin configuration contribution. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		/** Register localized OpenCode Go configuration under Plugin configuration. */
		function apply(ctx) {
			const localeNamespace = "settings.opencode-go";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-llm-opencode-go: Plugin configuration copy");
			const t = ctx.locale.bind(localeNamespace);
			const scope = ctx.settingsScope.bind({
				namespace: OPENCODE_GO_SETTINGS_NAMESPACE,
				decode: decodeOpenCodeGoSettings
			});
			const picker = new OpenCodeGoModelPickerController();
			const { api: connectionApi, rpc } = ctx.get("connection");
			const describeCredential = async () => {
				const ref = scope.getSnapshot().value?.apiKeyEnv ?? "OPENCODE_GO_API_KEY";
				const response = await connectionApi.credentials.describe({ refs: [ref] });
				if (!response.result.ok) throw new Error(response.result.error.message);
				const credential = response.result.value.credentials[ref];
				return {
					configured: credential?.configured ?? false,
					writable: credential?.writable ?? true
				};
			};
			const storeApiKey = async (value) => {
				const ref = scope.getSnapshot().value?.apiKeyEnv ?? "OPENCODE_GO_API_KEY";
				const response = await connectionApi.credentials.set({
					ref,
					value
				});
				if (!response.result.ok) throw new Error(response.result.error.message);
			};
			const saveConfiguration = async (settings, apiKey) => {
				await scope.set("baseURL", settings.baseURL);
				await scope.set("models", settings.models);
				if (apiKey !== void 0) await storeApiKey(apiKey);
				const accepted = scope.getSnapshot();
				if (accepted.value === void 0 || accepted.revision === void 0) throw new Error(t("requestFailed"));
				return {
					settings: accepted.value,
					revision: accepted.revision
				};
			};
			const callPlugin = async (endpoint, payload) => {
				const controller = new AbortController();
				const timer = setTimeout(() => {
					controller.abort();
				}, 2e4);
				try {
					return await rpc.call(OPENCODE_GO_RPC_CHANNEL, endpoint, payload, controller.signal);
				} catch (error) {
					if (controller.signal.aborted) throw new Error(t("requestFailed"));
					throw error;
				} finally {
					clearTimeout(timer);
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
			ensureProviderSection(ctx);
			ctx.slots.inject("settings.provider.item", () => ctx.slots.register({
				name: "settings.provider.item",
				key: OPENCODE_GO_SETTINGS_NAMESPACE,
				locale: localeNamespace,
				inject: () => ({
					t,
					hooks: { openCodeGoSettings: scope },
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
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
