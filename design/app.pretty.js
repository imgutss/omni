"use strict";
(() => {
    var _t = "x-kaveh-csrf",
        B = class extends Error {
            constructor(t, s, i, o) {
                super(i), this.status = t, this.code = s, this.detail = o
            }
        };
    async function x(e, t, s, {
        retry: i = 1,
        signal: o
    } = {}) {
        let r = {
            method: e,
            headers: {
                [_t]: "1"
            },
            credentials: "same-origin",
            signal: o
        };
        s !== void 0 && (r.headers["content-type"] = "application/json", r.body = JSON.stringify(s));
        let c;
        for (let f = 0; f <= i; f++) try {
            let u = await fetch(t, r);
            if (u.status === 204) return null;
            let p = (u.headers.get("content-type") || "").includes("json") ? await u.json() : {
                raw: await u.text()
            };
            if (!u.ok || p.ok === !1) throw new B(u.status, p.code || "error", p.error || u.statusText, p.detail);
            return p
        } catch (u) {
            if (c = u, !(u instanceof B ? u.status >= 500 : !(u instanceof DOMException && u.name === "AbortError")) || f === i) break;
            await new Promise(p => setTimeout(p, 300 * (f + 1)))
        }
        throw c
    }
    var b = {
        get: (e, t) => x("GET", e, void 0, t),
        post: (e, t, s) => x("POST", e, t ?? {}, s),
        put: (e, t, s) => x("PUT", e, t ?? {}, s),
        patch: (e, t, s) => x("PATCH", e, t ?? {}, s),
        del: (e, t) => x("DELETE", e, void 0, t),
        whoami: () => x("GET", "/api/whoami", void 0, {
            retry: 0
        }),
        login: (e, t) => x("POST", "/api/login", {
            password: e,
            username: t
        }, {
            retry: 0
        }),
        setup: (e, t) => x("POST", "/api/setup", {
            password: e,
            username: t
        }, {
            retry: 0
        }),
        logout: () => x("POST", "/api/logout", {}, {
            retry: 0
        }),
        changePassword: (e, t) => x("POST", "/api/password", {
            current: e,
            next: t
        }, {
            retry: 0
        }),
        overview: (e = 7) => x("GET", `/api/overview?days=${e}`),
        users: (e = {}) => x("GET", `/api/users?${new URLSearchParams(e)}`),
        user: e => x("GET", `/api/users/${encodeURIComponent(e)}`),
        createUser: e => x("POST", "/api/users", e),
        updateUser: (e, t) => x("PATCH", `/api/users/${encodeURIComponent(e)}`, t),
        deleteUser: e => x("DELETE", `/api/users/${encodeURIComponent(e)}`),
        bulk: (e, t, s) => x("POST", "/api/users/bulk", {
            usernames: e,
            op: t,
            value: s
        }),
        resetUser: (e, t) => x("POST", `/api/users/${encodeURIComponent(e)}/reset`, t),
        rotateToken: e => x("POST", `/api/users/${encodeURIComponent(e)}/rotate-token`),
        rotateUuid: e => x("POST", `/api/users/${encodeURIComponent(e)}/rotate-uuid`),
        userUsage: (e, t = 14) => x("GET", `/api/stats/usage?username=${encodeURIComponent(e)}&days=${t}`),
        settings: () => x("GET", "/api/settings"),
        saveSettings: e => x("PUT", "/api/settings", e),
        signup: () => x("POST", "/api/signup", {}, {
            retry: 0
        }),
        fragments: () => x("GET", "/api/fragments"),
        probeNode: e => x("POST", "/api/diag/probe-node", {
            proxy: e
        }, {
            retry: 0
        }),
        rankIps: (e, t) => x("POST", "/api/diag/rank-ips", {
            ips: e,
            host: t
        }, {
            retry: 0
        }),
        ping: e => x("GET", `/api/diag/ping?target=${encodeURIComponent(e)}`, {
            retry: 0
        }),
        logs: (e = 50) => x("GET", `/api/diag/logs?limit=${e}`),
        maintenance: () => x("POST", "/api/diag/maintenance", {}, {
            retry: 0
        }),
        sessions: () => x("GET", "/api/sessions"),
        revoke: e => x("POST", "/api/sessions/revoke", {
            id: e
        }),
        revokeAll: () => x("POST", "/api/sessions/revoke", {
            all: !0
        })
    };

    function le(e, t = "") {
        return `/s/${e}${t?`?type=${t}`:""}`
    }

    function Ee() {
        let e = document.createElement("a");
        e.href = "/api/backup", e.download = "", document.body.append(e), e.click(), e.remove()
    }
    var Je = {
            fa: {
                app: {
                    name: "\u06A9\u0627\u0648\u0647",
                    tagline: "\u067E\u0646\u0644 \u067E\u0631\u0648\u06A9\u0633\u06CC \u0644\u0628\u0647\u200C\u0627\u06CC"
                },
                nav: {
                    dashboard: "\u062F\u0627\u0634\u0628\u0648\u0631\u062F",
                    users: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
                    settings: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",
                    diag: "\u0639\u06CC\u0628\u200C\u06CC\u0627\u0628\u06CC",
                    sessions: "\u0646\u0634\u0633\u062A\u200C\u0647\u0627",
                    logout: "\u062E\u0631\u0648\u062C",
                    scanner: "\u0627\u0633\u06A9\u0646\u0631",
                    dns: "\u062F\u06CC\u200C\u0627\u0646\u200C\u0627\u0633",
                    configs: "\u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627"
                },
                omni: {
                    heroTag: "\u067E\u0646\u0644 \u0634\u062E\u0635\u06CC \u0631\u0648\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \xB7 \u06A9\u0627\u0648\u0647",
                    online: "\u0622\u0646\u0644\u0627\u06CC\u0646",
                    statSni: "SNI \u067E\u06CC\u0634\u200C\u0641\u0631\u0636",
                    statPorts: "\u067E\u0648\u0631\u062A\u200C\u0647\u0627",
                    statIps: "\u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632",
                    statUsers: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
                    statColo: "\u0644\u0628\u0647\u0654 \u06A9\u0644\u0627\u062F\u0641\u0644\u0631",
                    localMode: "\u062D\u0627\u0644\u062A \u0645\u062D\u0644\u06CC"
                },
                cfg: {
                    title: "\u0633\u0627\u0632\u0646\u062F\u0647\u0654 \u06A9\u0627\u0646\u0641\u06CC\u06AF",
                    desc: "\u0645\u062B\u0644 \u0627\u0648\u0645\u0646\u06CC: \u0622\u062F\u0631\u0633 \u0648 \u067E\u0648\u0631\u062A \u0648 \u067E\u0631\u0648\u062A\u06A9\u0644 \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u060C \u062E\u0631\u0648\u062C\u06CC \u0628\u0647 \u0647\u0631 \u0641\u0631\u0645\u062A\u06CC \u0628\u06AF\u06CC\u0631.",
                    build: "\u0628\u0633\u0627\u0632 \u26A1",
                    addresses: "\u0622\u062F\u0631\u0633\u200C\u0647\u0627",
                    fromClean: "\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632",
                    fromHost: "\u0647\u0627\u0633\u062A \u067E\u0646\u0644",
                    fromCustom: "\u062F\u0644\u062E\u0648\u0627\u0647",
                    ipv6: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC IPv6 \u06A9\u0644\u0627\u062F\u0641\u0644\u0631",
                    cleanAvailable: "\u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \u0645\u0648\u062C\u0648\u062F",
                    proxyips: "\u067E\u0631\u0648\u06A9\u0633\u06CC \u0622\u06CC\u200C\u067E\u06CC",
                    protoPorts: "\u067E\u0631\u0648\u062A\u06A9\u0644 \u0648 \u067E\u0648\u0631\u062A\u200C\u0647\u0627",
                    fragment: "\u0641\u0631\u06AF\u0645\u0646\u062A",
                    hint: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \xAB\u0628\u0633\u0627\u0632\xBB \u0631\u0627 \u0628\u0632\u0646 \u2014 \u062E\u0631\u0648\u062C\u06CC \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u0638\u0627\u0647\u0631 \u0645\u06CC\u200C\u0634\u0648\u062F.",
                    configs: "\u06A9\u0627\u0646\u0641\u06CC\u06AF",
                    user: "\u06A9\u0627\u0631\u0628\u0631",
                    noUser: "\u0627\u0648\u0644 \u06CC\u06A9 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0633\u0627\u0632",
                    toOmni: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0647 \u0627\u0648\u0645\u0646\u06CC",
                    subLink: "\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0627\u06CC\u0646 \u06A9\u0627\u0631\u0628\u0631"
                },
                scanner: {
                    title: "\u0627\u0633\u06A9\u0646\u0631 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632",
                    desc: "\u062A\u0623\u062E\u06CC\u0631 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u06A9\u0644\u0627\u062F\u0641\u0644\u0631 \u0631\u0627 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062E\u0648\u062F\u062A \u0628\u0633\u0646\u062C \u06CC\u0627 \u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0631\u0627 \u0627\u0632 \u0644\u0628\u0647 \u0628\u06AF\u06CC\u0631\u061B \u0628\u0647\u062A\u0631\u06CC\u0646\u200C\u0647\u0627 \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u06A9\u0646.",
                    start: "\u0634\u0631\u0648\u0639 \u0627\u0633\u06A9\u0646",
                    rank: "\u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0627\u0632 \u0644\u0628\u0647\u0654 \u06A9\u0644\u0648\u062F\u0641\u0644\u0631",
                    apply: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0631\u062A\u0631\u06CC\u0646\u200C\u0647\u0627 \u0628\u0647 \u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632",
                    hint: "\u0622\u0645\u0627\u062F\u0647 \u2014 \u0627\u0633\u06A9\u0646 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u062A\u0648 \u062A\u0623\u062E\u06CC\u0631 \u0648\u0627\u0642\u0639\u06CC \u0627\u067E\u0631\u0627\u062A\u0648\u0631\u062A \u0631\u0627 \u0645\u06CC\u200C\u0633\u0646\u062C\u062F.",
                    empty: "\u0647\u0646\u0648\u0632 \u0646\u062A\u06CC\u062C\u0647\u200C\u0627\u06CC \u0646\u06CC\u0633\u062A.",
                    testing: "\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631\u2026",
                    timeout: "\u0642\u0637\u0639",
                    healthy: "\u0633\u0627\u0644\u0645",
                    done: "\u0627\u0633\u06A9\u0646 \u062A\u0645\u0627\u0645 \u0634\u062F",
                    reachable: "\u0642\u0627\u0628\u0644\u200C\u062F\u0633\u062A\u0631\u0633",
                    ranking: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0628\u0647 \u0644\u0628\u0647\u0654 \u06A9\u0644\u0627\u062F\u0641\u0644\u0631\u2026",
                    edgeOk: "\u0633\u0627\u0644\u0645 \u0627\u0632 \u0644\u0628\u0647:",
                    rankFail: "\u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0646\u0627\u0645\u0648\u0641\u0642",
                    saved: "\u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F",
                    none: "\u0646\u062A\u06CC\u062C\u0647\u0654 \u0642\u0627\u0628\u0644\u200C\u0630\u062E\u06CC\u0631\u0647 \u0646\u06CC\u0633\u062A",
                    ranges: "\u0631\u0646\u062C\u200C\u0647\u0627\u06CC \u0627\u0633\u06A9\u0646 (CIDR)",
                    rangesHint: "\u0627\u0632 \u0647\u0631 \u0631\u0646\u062C \u0646\u0645\u0648\u0646\u0647\u200C\u0628\u0631\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0628\u0627 \u0641\u0631\u0645\u062A a.b.c.d/bit\u060C \u0647\u0631 \u0631\u0646\u062C \u062F\u0631 \u06CC\u06A9 \u062E\u0637."
                },
                dns: {
                    title: "\u062F\u06CC\u200C\u0627\u0646\u200C\u0627\u0633 / DoH",
                    desc: "\u0622\u067E\u0633\u062A\u0631\u06CC\u0645 DoH \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u062A\u0633\u062A \u06A9\u0646.",
                    active: "\u0641\u0639\u0627\u0644",
                    ir: "\u0627\u06CC\u0631\u0627\u0646",
                    saved: "\u0630\u062E\u06CC\u0631\u0647 \u0634\u062F",
                    error: "\u0630\u062E\u06CC\u0631\u0647 \u0646\u0627\u0645\u0648\u0641\u0642",
                    pick: "\u0627\u0646\u062A\u062E\u0627\u0628",
                    test: "\u062A\u0633\u062A",
                    note: "\u067E\u06CC\u0634\u200C\u0641\u0631\u0636\u200C\u0647\u0627\u06CC \u0627\u06CC\u0631\u0627\u0646 (\u0634\u06A9\u0646\u060C \u0627\u0644\u06A9\u062A\u0631\u0648\u060C \u0631\u0627\u062F\u0627\u0631\u060C \u06F4\u06F0\u06F3\u060C \u0628\u06AF\u0630\u0631) \u0648 \u062C\u0647\u0627\u0646\u06CC \u2014 \u062A\u0633\u062A\u060C \u0632\u0645\u0627\u0646 \u067E\u0627\u0633\u062E \u0648\u0627\u0642\u0639\u06CC \u0631\u0627 \u0646\u0634\u0627\u0646 \u0645\u06CC\u200C\u062F\u0647\u062F."
                },
                signup: {
                    button: "\u0633\u0627\u062E\u062A \u06A9\u0627\u0646\u0641\u06CC\u06AF \u0631\u0627\u06CC\u06AF\u0627\u0646",
                    title: "\u06A9\u0627\u0646\u0641\u06CC\u06AF \u062E\u0648\u062F\u062A \u0631\u0627 \u0628\u0633\u0627\u0632",
                    sub: "\u0628\u062F\u0648\u0646 \u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u067E\u06CC\u0686\u06CC\u062F\u0647 \u2014 \u06CC\u06A9 \u06A9\u0644\u06CC\u06A9",
                    step1: "\u062F\u06A9\u0645\u0647\u0654 \u067E\u0627\u06CC\u06CC\u0646 \u0631\u0627 \u0628\u0632\u0646 \u062A\u0627 \u062D\u0633\u0627\u0628 \u0648 \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u062A\u0648 \u0633\u0627\u062E\u062A\u0647 \u0634\u0648\u062F.",
                    step2: "\u0644\u06CC\u0646\u06A9 \u06CC\u0627 QR \u0631\u0627 \u062F\u0631 v2rayNG / Hiddify / Clash \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646.",
                    step3: "\u0633\u0647\u0645\u06CC\u0647 \u0648 \u062A\u0627\u0631\u06CC\u062E \u0627\u0646\u0642\u0636\u0627 \u0627\u0632 \u0627\u0648\u0644\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644 \u062D\u0633\u0627\u0628 \u0645\u06CC\u200C\u0634\u0648\u062F.",
                    create: "\u0628\u0633\u0627\u0632! \u26A1",
                    doneTitle: "\u06A9\u0627\u0646\u0641\u06CC\u06AF \u062A\u0648 \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A \u{1F389}",
                    doneSub: "\u0644\u06CC\u0646\u06A9 \u0632\u06CC\u0631 \u0631\u0627 \u062F\u0631 \u06A9\u0644\u0627\u06CC\u0646\u062A\u062A \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646",
                    hint: "\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0631\u0627 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062E\u0648\u062F\u062A \u0646\u06AF\u0647 \u062F\u0627\u0631\u061B \u0647\u0631 \u062F\u0633\u062A\u06AF\u0627\u0647 \u06A9\u0647 \u0628\u0627 \u0622\u0646 \u0648\u0635\u0644 \u0634\u0648\u062F \u0627\u0632 \u0633\u0647\u0645\u06CC\u0647\u200C\u0627\u062A \u06A9\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F.",
                    backLogin: "\u0648\u0631\u0648\u062F \u0645\u062F\u06CC\u0631",
                    settingToggle: "\u062B\u0628\u062A\u200C\u0646\u0627\u0645 \u0639\u0645\u0648\u0645\u06CC (\u0633\u0644\u0641\u200C\u0633\u0631\u0648\u06CC\u0633 \u0628\u0627\u0632\u062F\u06CC\u062F\u06A9\u0646\u0646\u062F\u06AF\u0627\u0646)",
                    maxPerIp: "\u062D\u062F\u0627\u06A9\u062B\u0631 \u062D\u0633\u0627\u0628 \u0628\u0647\u200C\u0627\u0632\u0627\u06CC \u0647\u0631 \u0622\u06CC\u200C\u067E\u06CC \u062F\u0631 \u0631\u0648\u0632"
                },
                login: {
                    title: "\u0648\u0631\u0648\u062F \u0628\u0647 \u067E\u0646\u0644",
                    setupTitle: "\u0631\u0627\u0647\u200C\u0627\u0646\u062F\u0627\u0632\u06CC \u06A9\u0627\u0648\u0647",
                    password: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631",
                    username: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC",
                    newPassword: "\u0631\u0645\u0632 \u062C\u062F\u06CC\u062F",
                    submit: "\u0648\u0631\u0648\u062F",
                    setup: "\u0633\u0627\u062E\u062A \u067E\u0646\u0644",
                    recover: "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0631\u0645\u0632",
                    hint: "\u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0628\u0627 PBKDF2 \u0648 \u06F2\u06F1\u06F0\u066C\u06F0\u06F0\u06F0 \u062A\u06A9\u0631\u0627\u0631 \u0647\u0634 \u0645\u06CC\u200C\u0634\u0648\u062F.",
                    setupHint: "\u062D\u062F\u0627\u0642\u0644 \u06F1\u06F0 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631. \u0627\u06CC\u0646 \u0631\u0645\u0632 \u062A\u0646\u0647\u0627 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u0642\u0627\u0628\u0644 \u062A\u0646\u0638\u06CC\u0645 \u0627\u0633\u062A."
                },
                dash: {
                    users: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
                    active: "\u0641\u0639\u0627\u0644",
                    expired: "\u0645\u0646\u0642\u0636\u06CC",
                    traffic: "\u062A\u0631\u0627\u0641\u06CC\u06A9 \u0645\u0635\u0631\u0641\u06CC",
                    cf: "\u0633\u0647\u0645\u06CC\u0647\u200C\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631",
                    reqToday: "\u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0627\u0645\u0631\u0648\u0632",
                    topUsers: "\u067E\u0631\u0645\u0635\u0631\u0641\u200C\u062A\u0631\u06CC\u0646\u200C\u0647\u0627",
                    traffic7: "\u062A\u0631\u0627\u0641\u06CC\u06A9 \u06F7 \u0631\u0648\u0632 \u0627\u062E\u06CC\u0631",
                    alerts: "\u0647\u0634\u062F\u0627\u0631\u0647\u0627",
                    noAlerts: "\u0647\u0645\u0647\u200C\u0686\u06CC\u0632 \u0633\u0627\u0644\u0645 \u0627\u0633\u062A \u2705",
                    noCf: "\u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u0633\u0647\u0645\u06CC\u0647\u060C CF_ACCOUNT_ID \u0648 CF_API_TOKEN \u0631\u0627 \u062A\u0646\u0638\u06CC\u0645 \u06A9\u0646\u06CC\u062F.",
                    cfDanger: "\u0633\u0647\u0645\u06CC\u0647\u200C\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u0646\u0632\u062F\u06CC\u06A9 \u0627\u062A\u0645\u0627\u0645 \u0627\u0633\u062A \u2014 \u0627\u062D\u062A\u0645\u0627\u0644 \u0628\u0646 \u0634\u062F\u0646 \u0627\u06A9\u0627\u0646\u062A.",
                    expiringSoon: "\u06A9\u0627\u0631\u0628\u0631 \u062A\u0627 \u06F2\u06F4 \u0633\u0627\u0639\u062A \u062F\u06CC\u06AF\u0631 \u0645\u0646\u0642\u0636\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F."
                },
                users: {
                    title: "\u06A9\u0627\u0631\u0628\u0631\u0627\u0646",
                    create: "\u06A9\u0627\u0631\u0628\u0631 \u062C\u062F\u06CC\u062F",
                    search: "\u062C\u0633\u062A\u062C\u0648\u06CC \u0646\u0627\u0645\u060C \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u06CC\u0627 UUID\u2026",
                    col: {
                        user: "\u06A9\u0627\u0631\u0628\u0631",
                        status: "\u0648\u0636\u0639\u06CC\u062A",
                        traffic: "\u0645\u0635\u0631\u0641",
                        quota: "\u0633\u0647\u0645\u06CC\u0647",
                        expiry: "\u0627\u0646\u0642\u0636\u0627",
                        devices: "\u062F\u0633\u062A\u06AF\u0627\u0647",
                        actions: ""
                    },
                    all: "\u0647\u0645\u0647",
                    activeOnly: "\u0641\u0639\u0627\u0644",
                    disabledOnly: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644",
                    expiredOnly: "\u0645\u0646\u0642\u0636\u06CC",
                    selected: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u062F\u0647",
                    bulkEnable: "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC",
                    bulkDisable: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC",
                    bulkReset: "\u0631\u06CC\u0633\u062A \u062D\u062C\u0645",
                    bulkExtend: "\u062A\u0645\u062F\u06CC\u062F \u0631\u0648\u0632",
                    bulkDelete: "\u062D\u0630\u0641",
                    empty: "\u0647\u0646\u0648\u0632 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0646\u0633\u0627\u062E\u062A\u0647\u200C\u0627\u06CC\u062F",
                    emptyHint: "\u0627\u0648\u0644\u06CC\u0646 \u06A9\u0627\u0631\u0628\u0631 \u0631\u0627 \u0628\u0633\u0627\u0632\u06CC\u062F \u062A\u0627 \u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u062A\u0648\u0644\u06CC\u062F \u0634\u0648\u062F.",
                    confirmDelete: "\u062D\u0630\u0641 \u06A9\u0627\u0631\u0628\u0631 \xAB{name}\xBB\u061F \u0627\u06CC\u0646 \u0639\u0645\u0644 \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06CC\u0633\u062A.",
                    confirmBulkDelete: "\u062D\u0630\u0641 {n} \u06A9\u0627\u0631\u0628\u0631\u061F \u0627\u06CC\u0646 \u0639\u0645\u0644 \u0642\u0627\u0628\u0644 \u0628\u0627\u0632\u06AF\u0634\u062A \u0646\u06CC\u0633\u062A.",
                    form: {
                        username: "\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC",
                        quota: "\u062D\u062C\u0645 (\u06AF\u06CC\u06AF\u0627\u0628\u0627\u06CC\u062A)",
                        days: "\u0645\u062F\u062A (\u0631\u0648\u0632)",
                        devices: "\u0633\u0642\u0641 \u062F\u0633\u062A\u06AF\u0627\u0647 \u0647\u0645\u0632\u0645\u0627\u0646",
                        requests: "\u0633\u0642\u0641 \u062F\u0631\u062E\u0648\u0627\u0633\u062A (\u06F0 = \u0646\u0627\u0645\u062D\u062F\u0648\u062F)",
                        firstConnect: "\u0634\u0631\u0648\u0639 \u0632\u0645\u0627\u0646 \u0627\u0632 \u0627\u0648\u0644\u06CC\u0646 \u0627\u062A\u0635\u0627\u0644",
                        fragment: "\u067E\u0631\u06CC\u0633\u062A \u0641\u0631\u06AF\u0645\u0646\u062A",
                        fingerprint: "\u0627\u062B\u0631 \u0627\u0646\u06AF\u0634\u062A TLS",
                        ips: "\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 (\u0647\u0631 \u062E\u0637 \u06CC\u06A9\u06CC)",
                        proxies: "\u067E\u0631\u0648\u06A9\u0633\u06CC \u0628\u0627\u0644\u0627\u062F\u0633\u062A\u06CC (\u0647\u0631 \u062E\u0637 \u06CC\u06A9\u06CC)",
                        note: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A",
                        blockList: "\u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627\u06CC \u0645\u0633\u062F\u0648\u062F (\u0647\u0631 \u062E\u0637 \u06CC\u06A9\u06CC)",
                        active: "\u0641\u0639\u0627\u0644",
                        usernameHint: "\u06F3 \u062A\u0627 \u06F3\u06F2 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 \u0627\u0646\u06AF\u0644\u06CC\u0633\u06CC\u060C \u0639\u062F\u062F\u060C . _ -"
                    },
                    drawer: {
                        configs: "\u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627",
                        usage: "\u0645\u0635\u0631\u0641",
                        sub: "\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9",
                        qr: "\u06A9\u06CC\u0648\u0622\u0631",
                        copy: "\u06A9\u067E\u06CC",
                        copied: "\u06A9\u067E\u06CC \u0634\u062F!",
                        rotateToken: "\u0686\u0631\u062E\u0634 \u062A\u0648\u06A9\u0646 \u0627\u0634\u062A\u0631\u0627\u06A9",
                        rotateUuid: "\u0686\u0631\u062E\u0634 UUID",
                        reset: "\u0631\u06CC\u0633\u062A \u062D\u062C\u0645",
                        statusPage: "\u0635\u0641\u062D\u0647 \u0648\u0636\u0639\u06CC\u062A",
                        liveTest: "\u062A\u0633\u062A \u0632\u0646\u062F\u0647\u200C\u06CC \u0627\u062A\u0635\u0627\u0644"
                    },
                    status: {
                        active: "\u0641\u0639\u0627\u0644",
                        disabled: "\u063A\u06CC\u0631\u0641\u0639\u0627\u0644",
                        expired: "\u0645\u0646\u0642\u0636\u06CC",
                        exhausted: "\u062D\u062C\u0645 \u062A\u0645\u0627\u0645"
                    }
                },
                settings: {
                    title: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A",
                    general: "\u0639\u0645\u0648\u0645\u06CC",
                    network: "\u0634\u0628\u06A9\u0647",
                    security: "\u0627\u0645\u0646\u06CC\u062A",
                    danger: "\u0645\u0646\u0637\u0642\u0647 \u062E\u0637\u0631",
                    panelName: "\u0646\u0627\u0645 \u067E\u0646\u0644",
                    publicHost: "\u062F\u0627\u0645\u0646\u0647 \u0639\u0645\u0648\u0645\u06CC (SNI)",
                    port: "\u067E\u0648\u0631\u062A",
                    cleanIps: "\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0641\u0639\u0644\u06CC",
                    ipPool: "\u0645\u062E\u0632\u0646 \u0622\u06CC\u200C\u067E\u06CC \u0628\u0631\u0627\u06CC \u0686\u0631\u062E\u0634",
                    autoRotate: "\u0686\u0631\u062E\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0622\u06CC\u200C\u067E\u06CC",
                    rotateMinutes: "\u0641\u0627\u0635\u0644\u0647 \u0686\u0631\u062E\u0634 (\u062F\u0642\u06CC\u0642\u0647)",
                    mux: "\u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC Mux",
                    blockNsfw: "\u0645\u0633\u062F\u0648\u062F\u0633\u0627\u0632\u06CC \u0645\u062D\u062A\u0648\u0627\u06CC \u0628\u0632\u0631\u06AF\u0633\u0627\u0644",
                    blockAds: "\u0645\u0633\u062F\u0648\u062F\u0633\u0627\u0632\u06CC \u062A\u0628\u0644\u06CC\u063A\u0627\u062A",
                    remark: "\u067E\u06CC\u0634\u0648\u0646\u062F \u0646\u0627\u0645 \u06A9\u0627\u0646\u0641\u06CC\u06AF",
                    defaultQuota: "\u062D\u062C\u0645 \u067E\u06CC\u0634\u200C\u0641\u0631\u0636",
                    defaultDays: "\u0645\u062F\u062A \u067E\u06CC\u0634\u200C\u0641\u0631\u0636",
                    save: "\u0630\u062E\u06CC\u0631\u0647 \u062A\u063A\u06CC\u06CC\u0631\u0627\u062A",
                    saved: "\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F",
                    backup: "\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u06AF\u06CC\u0631\u06CC",
                    export: "\u062E\u0631\u0648\u062C\u06CC JSON",
                    import: "\u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0627\u0632 JSON",
                    changePassword: "\u062A\u063A\u06CC\u06CC\u0631 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631",
                    currentPassword: "\u0631\u0645\u0632 \u0641\u0639\u0644\u06CC",
                    maintenance: "\u062D\u0627\u0644\u062A \u062A\u0639\u0645\u06CC\u0631\u0627\u062A"
                },
                diag: {
                    title: "\u0639\u06CC\u0628\u200C\u06CC\u0627\u0628\u06CC",
                    probeNode: "\u062A\u0633\u062A \u067E\u0631\u0648\u06A9\u0633\u06CC \u0628\u0627\u0644\u0627\u062F\u0633\u062A\u06CC",
                    probeHint: "user:pass@1.2.3.4:1080 \u06CC\u0627 socks5://host:port",
                    run: "\u0627\u062C\u0631\u0627",
                    rankIps: "\u0631\u062A\u0628\u0647\u200C\u0628\u0646\u062F\u06CC \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632",
                    rankHint: "\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627 \u0631\u0627 \u0627\u0632 \u0644\u0628\u0647\u200C\u06CC \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u062A\u0633\u062A \u0645\u06CC\u200C\u06A9\u0646\u062F\u060C \u0646\u0647 \u0627\u0632 \u0645\u0631\u0648\u0631\u06AF\u0631 \u0634\u0645\u0627.",
                    ping: "\u062A\u0623\u062E\u06CC\u0631 \u0627\u0632 \u0644\u0628\u0647",
                    pingHint: "\u0633\u0647 \u0646\u0645\u0648\u0646\u0647 \u0627\u0632 \u0646\u0632\u062F\u06CC\u06A9\u200C\u062A\u0631\u06CC\u0646 POP \u06A9\u0644\u0648\u062F\u0641\u0644\u0631.",
                    audit: "\u06AF\u0632\u0627\u0631\u0634 \u0631\u0648\u06CC\u062F\u0627\u062F\u0647\u0627",
                    auditHint: "\u0647\u0631 \u062A\u063A\u06CC\u06CC\u0631\u060C \u0628\u0627 \u0628\u0627\u0632\u06CC\u06AF\u0631 \u0648 \u0632\u0645\u0627\u0646. \u0686\u06CC\u0632\u06CC \u06A9\u0647 Zeus \u0646\u062F\u0627\u0631\u062F.",
                    latency: "\u062A\u0623\u062E\u06CC\u0631",
                    healthy: "\u0633\u0627\u0644\u0645",
                    unhealthy: "\u0642\u0637\u0639",
                    colo: "\u0645\u0631\u06A9\u0632 \u062F\u0627\u062F\u0647",
                    maintenance: "\u0627\u062C\u0631\u0627\u06CC \u0646\u06AF\u0647\u062F\u0627\u0634\u062A",
                    maintenanceHint: "\u0647\u0645\u0627\u0646 \u06A9\u0627\u0631\u06CC \u06A9\u0647 \u06A9\u0631\u0648\u0646 \u0647\u0631 \u06F1\u06F0 \u062F\u0642\u06CC\u0642\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F: \u0627\u0646\u0642\u0636\u0627\u060C \u0686\u0631\u062E\u0634 \u0622\u06CC\u200C\u067E\u06CC\u060C \u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC. \u062F\u0631 Zeus \u0641\u0642\u0637 \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F \u062D\u062F\u0633 \u0628\u0632\u0646\u06CC\u062F \u06A9\u0647 \u0627\u062C\u0631\u0627 \u0634\u062F\u0647 \u06CC\u0627 \u0646\u0647.",
                    maintenanceDone: "\u0646\u06AF\u0647\u062F\u0627\u0634\u062A \u0627\u062C\u0631\u0627 \u0634\u062F",
                    expired: "\u0645\u0646\u0642\u0636\u06CC\u200C\u0634\u062F\u0647",
                    ipsRotated: "\u0622\u06CC\u200C\u067E\u06CC \u0686\u0631\u062E\u06CC\u062F\u0647"
                },
                live: {
                    hint: "\u062A\u0648\u0646\u0644 \u0631\u0627 \u0627\u0632 \u0647\u0645\u06CC\u0646\u200C\u062C\u0627 \u0628\u0627\u0632 \u0645\u06CC\u200C\u06A9\u0646\u062F \u0648 \u062A\u0623\u062E\u06CC\u0631 \u0648\u0627\u0642\u0639\u06CC \u0631\u0627 \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F.",
                    running: "\u062F\u0631 \u062D\u0627\u0644 \u062A\u0633\u062A\u2026",
                    ok: "\u0648\u0635\u0644 \u0634\u062F \u2014 \u062A\u0648\u0646\u0644 \u0633\u0627\u0644\u0645 \u0627\u0633\u062A.",
                    refused: "\u0631\u062F \u0634\u062F: UUID \u0646\u0627\u0645\u0639\u062A\u0628\u0631/\u063A\u06CC\u0631\u0641\u0639\u0627\u0644\u060C \u0633\u0642\u0641 \u062F\u0633\u062A\u06AF\u0627\u0647\u060C \u06CC\u0627 \u0634\u0628\u06A9\u0647 \u0628\u0633\u062A\u0647.",
                    nodata: "\u062A\u0648\u0646\u0644 \u0628\u0627\u0632 \u0634\u062F \u0627\u0645\u0627 \u0628\u0627\u0644\u0627\u062F\u0633\u062A \u062C\u0648\u0627\u0628 \u0646\u062F\u0627\u062F \u2014 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \u06CC\u0627 \u067E\u0631\u06CC\u0633\u062A \u0641\u0631\u06AF\u0645\u0646\u062A \u0631\u0627 \u0639\u0648\u0636 \u06A9\u0646.",
                    noopen: "\u062F\u0633\u062A\u200C\u062F\u0647\u06CC WebSocket \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F \u2014 \u062F\u0627\u0645\u0646\u0647/SNI \u06CC\u0627 \u0634\u0628\u06A9\u0647 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646."
                },
                common: {
                    cancel: "\u0627\u0646\u0635\u0631\u0627\u0641",
                    save: "\u0630\u062E\u06CC\u0631\u0647",
                    create: "\u0633\u0627\u062E\u062A",
                    delete: "\u062D\u0630\u0641",
                    edit: "\u0648\u06CC\u0631\u0627\u06CC\u0634",
                    close: "\u0628\u0633\u062A\u0646",
                    copy: "\u06A9\u067E\u06CC",
                    refresh: "\u0646\u0648\u0633\u0627\u0632\u06CC",
                    loading: "\u062F\u0631 \u062D\u0627\u0644 \u0628\u0627\u0631\u06AF\u0630\u0627\u0631\u06CC\u2026",
                    yes: "\u0628\u0644\u0647",
                    no: "\u062E\u06CC\u0631",
                    none: "\u2014",
                    search: "\u062C\u0633\u062A\u062C\u0648",
                    cmdk: "\u062C\u0633\u062A\u062C\u0648 \u06CC\u0627 \u0641\u0631\u0645\u0627\u0646\u2026",
                    offline: "\u0622\u0641\u0644\u0627\u06CC\u0646",
                    version: "\u0646\u0633\u062E\u0647",
                    gb: "\u06AF\u06CC\u06AF\u0627\u0628\u0627\u06CC\u062A",
                    day: "\u0631\u0648\u0632",
                    days: "\u0631\u0648\u0632"
                }
            },
            en: {
                app: {
                    name: "Kaveh",
                    tagline: "Edge proxy panel"
                },
                nav: {
                    dashboard: "Dashboard",
                    users: "Users",
                    settings: "Settings",
                    diag: "Diagnostics",
                    sessions: "Sessions",
                    logout: "Sign out",
                    scanner: "Scanner",
                    dns: "DNS",
                    configs: "Configs"
                },
                omni: {
                    heroTag: "Your personal panel on Cloudflare \xB7 Kaveh",
                    online: "Online",
                    statSni: "Default SNI",
                    statPorts: "Ports",
                    statIps: "Clean IPs",
                    statUsers: "Users",
                    statColo: "CF edge",
                    localMode: "local mode"
                },
                cfg: {
                    title: "Config builder",
                    desc: "OMNI-style: pick addresses, ports and protocols, export in every format.",
                    build: "Build \u26A1",
                    addresses: "Addresses",
                    fromClean: "Clean IPs",
                    fromHost: "Panel host",
                    fromCustom: "Custom",
                    ipv6: "Add Cloudflare IPv6 addresses",
                    cleanAvailable: "clean IPs available",
                    proxyips: "Proxy IPs",
                    protoPorts: "Protocols & ports",
                    fragment: "Fragment",
                    hint: "Pick options and hit Build \u2014 output appears here.",
                    configs: "config(s)",
                    user: "user",
                    noUser: "Create a user first",
                    toOmni: "Add to Omni",
                    subLink: "This user's subscription link"
                },
                scanner: {
                    title: "Clean IP scanner",
                    desc: "Probe Cloudflare IPs from your own browser or rank them from the edge; save the best ones to settings.",
                    start: "Start scan",
                    rank: "Rank from CF edge",
                    apply: "Add top IPs to clean list",
                    hint: "Ready \u2014 the browser scan measures your carrier's real latency.",
                    empty: "No results yet.",
                    testing: "Testing from browser\u2026",
                    timeout: "down",
                    healthy: "healthy",
                    done: "Scan finished",
                    reachable: "reachable",
                    ranking: "Asking the Cloudflare edge to rank\u2026",
                    edgeOk: "healthy from edge:",
                    rankFail: "Ranking failed",
                    saved: "Saved to settings",
                    none: "Nothing worth saving",
                    ranges: "Scan ranges (CIDR)",
                    rangesHint: "Sampled per range; a.b.c.d/bit, one per line."
                },
                dns: {
                    title: "DNS / DoH",
                    desc: "Pick the DoH upstream and test it right here.",
                    active: "active",
                    ir: "IR",
                    saved: "Saved",
                    error: "Save failed",
                    pick: "Pick",
                    test: "Test",
                    note: "Iranian defaults (Shecan, Electro, Radar, 403, Begzar) plus global ones \u2014 Test shows the real response time."
                },
                signup: {
                    button: "Create your free config",
                    title: "Make your own config",
                    sub: "One click, no forms",
                    step1: "Hit the button below and we create your account + subscription link.",
                    step2: "Paste the link or QR into v2rayNG / Hiddify / Clash.",
                    step3: "Quota and expiry start counting from your first connection.",
                    create: "Create it! \u26A1",
                    doneTitle: "Your config is ready \u{1F389}",
                    doneSub: "Add the link below in your client",
                    hint: "Keep the subscription link private \u2014 every device connecting through it consumes your quota.",
                    backLogin: "Admin sign-in",
                    settingToggle: "Public signup (self-service for visitors)",
                    maxPerIp: "Max accounts per IP per day"
                },
                login: {
                    title: "Sign in",
                    setupTitle: "Set up Kaveh",
                    password: "Password",
                    username: "Username",
                    newPassword: "New password",
                    submit: "Sign in",
                    setup: "Create panel",
                    recover: "Recover",
                    hint: "Passwords are hashed with PBKDF2, 210,000 iterations.",
                    setupHint: "At least 10 characters. This can only be set once."
                },
                dash: {
                    users: "Users",
                    active: "Active",
                    expired: "Expired",
                    traffic: "Traffic used",
                    cf: "Cloudflare quota",
                    reqToday: "Requests today",
                    topUsers: "Top consumers",
                    traffic7: "Traffic \u2014 last 7 days",
                    alerts: "Alerts",
                    noAlerts: "All clear \u2705",
                    noCf: "Set CF_ACCOUNT_ID and CF_API_TOKEN to see quota.",
                    cfDanger: "Cloudflare quota nearly exhausted \u2014 account ban risk.",
                    expiringSoon: "user(s) expire within 24 hours."
                },
                users: {
                    title: "Users",
                    create: "New user",
                    search: "Search name, note or UUID\u2026",
                    col: {
                        user: "User",
                        status: "Status",
                        traffic: "Used",
                        quota: "Quota",
                        expiry: "Expires",
                        devices: "Devices",
                        actions: ""
                    },
                    all: "All",
                    activeOnly: "Active",
                    disabledOnly: "Disabled",
                    expiredOnly: "Expired",
                    selected: "selected",
                    bulkEnable: "Enable",
                    bulkDisable: "Disable",
                    bulkReset: "Reset traffic",
                    bulkExtend: "Extend days",
                    bulkDelete: "Delete",
                    empty: "No users yet",
                    emptyHint: "Create your first user to generate a subscription link.",
                    confirmDelete: "Delete user \u201C{name}\u201D? This cannot be undone.",
                    confirmBulkDelete: "Delete {n} users? This cannot be undone.",
                    form: {
                        username: "Username",
                        quota: "Quota (GB)",
                        days: "Duration (days)",
                        devices: "Concurrent devices",
                        requests: "Request limit (0 = unlimited)",
                        firstConnect: "Start clock on first connect",
                        fragment: "Fragment preset",
                        fingerprint: "TLS fingerprint",
                        ips: "Clean IPs (one per line)",
                        proxies: "Upstream proxies (one per line)",
                        note: "Note",
                        blockList: "Blocked domains (one per line)",
                        active: "Active",
                        usernameHint: "3\u201332 chars: letters, digits, . _ -"
                    },
                    drawer: {
                        configs: "Configs",
                        usage: "Usage",
                        sub: "Subscription link",
                        qr: "QR",
                        copy: "Copy",
                        copied: "Copied!",
                        rotateToken: "Rotate sub token",
                        rotateUuid: "Rotate UUID",
                        reset: "Reset traffic",
                        statusPage: "Status page",
                        liveTest: "Live connection test"
                    },
                    status: {
                        active: "Active",
                        disabled: "Disabled",
                        expired: "Expired",
                        exhausted: "Exhausted"
                    }
                },
                settings: {
                    title: "Settings",
                    general: "General",
                    network: "Network",
                    security: "Security",
                    danger: "Danger zone",
                    panelName: "Panel name",
                    publicHost: "Public host (SNI)",
                    port: "Port",
                    cleanIps: "Current clean IPs",
                    ipPool: "IP pool for rotation",
                    autoRotate: "Auto-rotate IPs",
                    rotateMinutes: "Rotation interval (min)",
                    mux: "Enable Mux",
                    blockNsfw: "Block adult content",
                    blockAds: "Block ads",
                    remark: "Config name prefix",
                    defaultQuota: "Default quota",
                    defaultDays: "Default duration",
                    save: "Save changes",
                    saved: "Settings saved",
                    backup: "Backup",
                    export: "Export JSON",
                    import: "Import JSON",
                    changePassword: "Change password",
                    currentPassword: "Current password",
                    maintenance: "Maintenance mode"
                },
                diag: {
                    title: "Diagnostics",
                    probeNode: "Probe upstream proxy",
                    probeHint: "user:pass@1.2.3.4:1080 or socks5://host:port",
                    run: "Run",
                    rankIps: "Rank clean IPs",
                    rankHint: "Tested from Cloudflare's edge, not your browser.",
                    ping: "Edge latency",
                    pingHint: "Three samples from the nearest Cloudflare POP.",
                    audit: "Audit log",
                    auditHint: "Every change, with actor and time. Zeus has none.",
                    latency: "Latency",
                    healthy: "Healthy",
                    unhealthy: "Down",
                    colo: "Colo",
                    maintenance: "Run maintenance",
                    maintenanceHint: "Exactly what the cron does every 10 minutes: expiry, IP rotation, pruning. In Zeus you can only guess whether it ran.",
                    maintenanceDone: "Maintenance complete",
                    expired: "Expired",
                    ipsRotated: "IPs rotated"
                },
                live: {
                    hint: "Opens the tunnel from here and measures real latency.",
                    running: "Testing\u2026",
                    ok: "Connected \u2014 tunnel is healthy.",
                    refused: "Refused: unknown/disabled UUID, device limit, or blocked network.",
                    nodata: "Tunnel opened but upstream stayed silent \u2014 try another clean IP or fragment preset.",
                    noopen: "WebSocket handshake failed \u2014 check domain/SNI or your network."
                },
                common: {
                    cancel: "Cancel",
                    save: "Save",
                    create: "Create",
                    delete: "Delete",
                    edit: "Edit",
                    close: "Close",
                    copy: "Copy",
                    refresh: "Refresh",
                    loading: "Loading\u2026",
                    yes: "Yes",
                    no: "No",
                    none: "\u2014",
                    search: "Search",
                    cmdk: "Search or run a command\u2026",
                    offline: "Offline",
                    version: "Version",
                    gb: "GB",
                    day: "day",
                    days: "days"
                }
            }
        },
        P = {
            lang: localStorage.getItem("kaveh.lang") || "fa",
            dir() {
                return this.lang === "fa" ? "rtl" : "ltr"
            },
            set(e) {
                this.lang = e, localStorage.setItem("kaveh.lang", e), document.documentElement.lang = e, document.documentElement.dir = this.dir()
            },
            t(e, t) {
                let s = o => e.split(".").reduce((r, c) => r == null ? r : r[c], o),
                    i = s(Je[this.lang]) ?? s(Je.en) ?? e;
                if (t)
                    for (let [o, r] of Object.entries(t)) i = i.replaceAll(`{${o}}`, r);
                return i
            }
        },
        n = (e, t) => P.t(e, t);

    function v(e, {
        digits: t = 0
    } = {}) {
        return Number(e || 0).toLocaleString(P.lang === "fa" ? "fa-IR" : "en-US", {
            minimumFractionDigits: t,
            maximumFractionDigits: t
        })
    }
    var D = e => {
        let t = Number(e || 0);
        return t < 1024 ? `${t} B` : t < 1024 ** 2 ? `${(t/1024).toFixed(1)} KB` : t < 1024 ** 3 ? `${(t/1024**2).toFixed(1)} MB` : `${(t/1024**3).toFixed(2)} GB`
    };

    function ye(e) {
        if (!e) return n("common.none");
        let t = Math.floor((Date.now() - e) / 1e3);
        if (t < 60) return P.lang === "fa" ? `${t} \u062B\u0627\u0646\u06CC\u0647 \u067E\u06CC\u0634` : `${t}s ago`;
        let s = Math.floor(t / 60);
        if (s < 60) return P.lang === "fa" ? `${s} \u062F\u0642\u06CC\u0642\u0647 \u067E\u06CC\u0634` : `${s}m ago`;
        let i = Math.floor(s / 60);
        if (i < 24) return P.lang === "fa" ? `${i} \u0633\u0627\u0639\u062A \u067E\u06CC\u0634` : `${i}h ago`;
        let o = Math.floor(i / 24);
        return P.lang === "fa" ? `${o} \u0631\u0648\u0632 \u067E\u06CC\u0634` : `${o}d ago`
    }

    function ce(e) {
        if (e == null) return "\u221E";
        if (e <= 0) return P.lang === "fa" ? "\u062A\u0645\u0627\u0645 \u0634\u062F\u0647" : "expired";
        let t = Math.floor(e / 864e5),
            s = Math.floor(e % 864e5 / 36e5);
        return t > 0 ? P.lang === "fa" ? `${t} \u0631\u0648\u0632 \u0648 ${s} \u0633\u0627\u0639\u062A` : `${t}d ${s}h` : P.lang === "fa" ? `${s} \u0633\u0627\u0639\u062A` : `${s}h`
    }
    var Ke = e => e ? new Date(e).toLocaleDateString(P.lang === "fa" ? "fa-IR" : "en-US") : n("common.none");
    var a = e => String(e ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"),
        Qe = {
            dash: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
            users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
            gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 2h-4l-.4 2.6c-.7.3-1.4.7-2 1.2l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
            activity: "M22 12h-4l-3 9L9 3l-3 9H2",
            shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
            logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
            plus: "M12 5v14M5 12h14",
            search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
            refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
            copy: "M9 9h10v12H9zM5 15H3V3h12v2",
            trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
            edit: "M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z",
            close: "M18 6 6 18M6 6l12 12",
            sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2M12 21v-2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M22 12h-2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
            moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
            globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.5-2.3 3.8-5.3 3.8-9S14.5 4.3 12 2C9.5 4.3 8.2 7.3 8.2 11s1.3 6.7 3.8 9ZM2.5 9h19M2.5 15h19",
            check: "M20 6 9 17l-5-5",
            alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
            bolt: "M13 2 3 14h7v8l10-12h-7z",
            link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
            qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3zM14 21h1v-3M21 14v1",
            download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
            upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
            play: "M6 3l14 9-14 9z",
            menu: "M3 6h18M3 12h18M3 18h18",
            chevron: "m9 18 6-6-6-6",
            clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3 2",
            filter: "M22 3H2l8 9.5V19l4 2v-8.5z",
            key: "M21 2l-2 2m-7.6 7.6a5 5 0 1 1-7 7 5 5 0 0 1 7-7Zm0 0L15 8m0 0 3 3 3-3-3-3",
            db: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3Zm8-3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5m16 7c0 1.7-3.6 3-8 3s-8-1.3-8-3",
            eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
            wifi: "M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0"
        },
        Et = new Set(["dash", "bolt", "play", "filter"]);

    function d(e, t = "") {
        let s = Qe[e] || Qe.bolt,
            i = Et.has(e);
        return `<svg viewBox="0 0 24 24" width="18" height="18" class="${t}" fill="${i?"currentColor":"none"}" stroke="${i?"none":"currentColor"}"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${s}"/></svg>`
    }

    function y(e, t = "info", s = 3200) {
        let i = document.getElementById("toasts");
        if (!i) return;
        let o = document.createElement("div");
        o.className = `toast ${t}`, o.innerHTML = `${d(t==="err"?"alert":t==="ok"?"check":"bolt")} <span>${a(e)}</span>`, o.style.display = "flex", o.style.gap = "8px", o.style.alignItems = "center", i.append(o), setTimeout(() => {
            o.style.transition = "opacity .25s, transform .25s", o.style.opacity = "0", o.style.transform = "translateY(6px)", setTimeout(() => o.remove(), 260)
        }, s)
    }
    var R = null;

    function Le({
        title: e,
        body: t,
        footer: s = "",
        wide: i = !1,
        onMount: o
    }) {
        return W(), R = document.createElement("div"), R.className = "overlay", R.innerHTML = `<div class="modal ${i?"modal-wide":""}" role="dialog" aria-modal="true" aria-label="${a(e)}">
      <div class="modal-head"><h2>${a(e)}</h2><div class="spacer"></div>
        <button class="btn btn-ghost btn-icon" data-action="close-modal" aria-label="${a(n("common.close"))}">${d("close")}</button></div>
      <div class="modal-body">${t}</div>
      ${s?`<div class="modal-foot">${s}</div>`:""}
    </div>`, R.addEventListener("mousedown", r => {
            r.target === R && W()
        }), document.body.append(R), document.body.style.overflow = "hidden", o?.(R), R.querySelector("input,select,textarea,button")?.focus(), R
    }

    function W() {
        R?.remove(), R = null, document.querySelector(".drawer") || (document.body.style.overflow = "")
    }

    function Q(e, {
        danger: t = !1,
        okLabel: s
    } = {}) {
        return new Promise(i => {
            Le({
                title: t ? n("common.delete") : "\u061F",
                body: `<p style="margin:0;font-size:14px;line-height:1.8">${a(e)}</p>`,
                footer: `<button class="btn" data-confirm="no">${a(n("common.cancel"))}</button>
               <button class="btn ${t?"btn-danger":"btn-primary"}" data-confirm="yes">${a(s||n("common.yes"))}</button>`,
                onMount: r => {
                    r.addEventListener("click", c => {
                        let f = c.target.closest("[data-confirm]");
                        f && (W(), i(f.dataset.confirm === "yes"))
                    })
                }
            })?.addEventListener("keydown", r => {
                r.key === "Escape" && (W(), i(!1))
            })
        })
    }

    function Ye({
        title: e,
        body: t,
        footer: s = "",
        onMount: i
    }) {
        J();
        let o = document.createElement("div");
        return o.className = "drawer", o.setAttribute("role", "dialog"), o.innerHTML = `<div class="modal-head"><h2>${a(e)}</h2><div class="spacer"></div>
      <button class="btn btn-ghost btn-icon" data-action="close-drawer">${d("close")}</button></div>
    <div class="modal-body" style="flex:1">${t}</div>
    ${s?`<div class="modal-foot">${s}</div>`:""}`, document.body.append(o), document.body.style.overflow = "hidden", i?.(o), o
    }

    function J() {
        document.querySelector(".drawer")?.remove(), R || (document.body.style.overflow = "")
    }
    var $e = (e, t = "") => `<div class="meter ${t}"><div class="meter-fill ${e>90?"danger":e>70?"warn":""}" style="width:${Math.min(100,e)}%"></div></div>`,
        Ce = e => `<span class="badge ${{active:"ok",expired:"danger",exhausted:"warn",disabled:""}[e]??""}">${a(n(`users.status.${e}`))}</span>`;

    function te(e, t = n("common.copy"), s = !0) {
        return `<button class="btn ${s?"btn-sm":""}" data-action="copy" data-copy="${a(e)}">${d("copy")} ${a(t)}</button>`
    }
    async function ae(e) {
        try {
            return await navigator.clipboard.writeText(e), !0
        } catch {
            let t = document.createElement("textarea");
            t.value = e, t.style.cssText = "position:fixed;opacity:0", document.body.append(t), t.select();
            let s = !1;
            try {
                s = document.execCommand("copy")
            } catch {}
            return t.remove(), s
        }
    }

    function de(e, t = 168) {
        let s = globalThis.qrcode;
        if (!s || !e) return "";
        try {
            let i = s(0, "M");
            return i.addData(e, "Byte"), i.make(), i.createSvgTag({
                cellSize: 4,
                margin: 2,
                scalable: !0
            })
        } catch {
            return ""
        }
    }

    function Xe(e = 6) {
        return Array.from({
            length: e
        }, () => '<tr><td colspan="7"><div class="skeleton" style="height:16px"></div></td></tr>').join("")
    }
    var ue = ({
        icon: e,
        label: t,
        value: s,
        sub: i,
        tone: o = ""
    }) => `
  <div class="card" style="display:flex;gap:13px;align-items:flex-start">
    <div class="kpi-icon" style="${o?`background:color-mix(in srgb, ${o} 14%, transparent);color:${o}`:""}">${d(e)}</div>
    <div style="min-width:0;flex:1">
      <div class="kpi-label">${a(t)}</div>
      <div class="kpi-value">${s}</div>
      ${i?`<div class="kpi-sub">${i}</div>`:""}
    </div>
  </div>`;

    function Pe(e, {
        height: t = 150,
        valueKey: s = "total",
        labelKey: i = "day",
        color: o = "var(--accent)"
    } = {}) {
        if (!e?.length) return `<svg class="chart" viewBox="0 0 600 ${t}" preserveAspectRatio="none"><text x="300" y="${t/2}" text-anchor="middle" class="chart-label">no data</text></svg>`;
        let r = 600,
            c = {
                l: 8,
                r: 8,
                t: 14,
                b: 22
            },
            f = Math.max(...e.map($ => Number($[s] || 0)), 1),
            u = (r - c.l - c.r) / e.length,
            m = e.map(($, M) => {
                let k = Number($[s] || 0),
                    L = Math.max(2, k / f * (t - c.t - c.b)),
                    S = c.l + M * u + u * .18,
                    C = t - c.b - L,
                    q = String($[i] || "").slice(5);
                return `<g><title>${$[i]} \u2014 ${D(k)}</title>
        <rect class="chart-bar" x="${S.toFixed(1)}" y="${C.toFixed(1)}" width="${(u*.64).toFixed(1)}" height="${L.toFixed(1)}" rx="4" style="fill:${o}"/>
        <text class="chart-label" x="${(S+u*.32).toFixed(1)}" y="${t-7}" text-anchor="middle">${q}</text></g>`
            }).join(""),
            p = [.25, .5, .75].map($ => {
                let M = c.t + (t - c.t - c.b) * $;
                return `<line class="chart-grid" x1="${c.l}" x2="${r-c.r}" y1="${M}" y2="${M}" stroke-dasharray="3 5"/>`
            }).join("");
        return `<svg class="chart" viewBox="0 0 ${r} ${t}" preserveAspectRatio="none" role="img">${p}${m}
    <text class="chart-label" x="${c.l}" y="10">${D(f)}</text></svg>`
    }

    function et(e, {
        height: t = 160
    } = {}) {
        if (!e?.length) return Pe([]);
        let s = 600,
            i = {
                l: 8,
                r: 8,
                t: 14,
                b: 22
            },
            o = Math.max(...e.map(u => (u.up || 0) + (u.down || 0)), 1),
            r = (s - i.l - i.r) / e.length,
            c = t - i.t - i.b,
            f = e.map((u, m) => {
                let p = i.l + m * r + r * .18,
                    $ = r * .64,
                    M = u.down / o * c,
                    k = u.up / o * c;
                return `<g><title>${u.day} \u2014 \u2193${D(u.down)} \u2191${D(u.up)}</title>
      <rect x="${p.toFixed(1)}" y="${(t-i.b-M).toFixed(1)}" width="${$.toFixed(1)}" height="${M.toFixed(1)}" rx="4" fill="var(--accent)" opacity=".85"/>
      <rect x="${p.toFixed(1)}" y="${(t-i.b-M-k).toFixed(1)}" width="${$.toFixed(1)}" height="${k.toFixed(1)}" rx="4" fill="var(--accent-2)" opacity=".85"/>
      <text class="chart-label" x="${(p+$/2).toFixed(1)}" y="${t-7}" text-anchor="middle">${String(u.day).slice(5)}</text></g>`
            }).join("");
        return `<svg class="chart" viewBox="0 0 ${s} ${t}" preserveAspectRatio="none">${f}
    <text class="chart-label" x="${i.l}" y="10">${D(o)}</text></svg>`
    }

    function Ae(e, {
        size: t = 74,
        stroke: s = 8,
        color: i = "var(--accent)",
        label: o
    } = {}) {
        let r = (t - s) / 2,
            c = 2 * Math.PI * r,
            f = Math.max(0, Math.min(100, Number(e) || 0)),
            u = f / 100 * c,
            m = f > 90 ? "var(--danger)" : f > 70 ? "var(--warn)" : i;
        return `<svg width="${t}" height="${t}" viewBox="0 0 ${t} ${t}" role="img" aria-label="${f}%">
    <circle cx="${t/2}" cy="${t/2}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${s}"/>
    <circle cx="${t/2}" cy="${t/2}" r="${r}" fill="none" stroke="${m}" stroke-width="${s}"
      stroke-linecap="round" stroke-dasharray="${u.toFixed(2)} ${c.toFixed(2)}"
      transform="rotate(-90 ${t/2} ${t/2})" style="transition:stroke-dasharray .6s cubic-bezier(.22,1,.36,1)"/>
    <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
      style="font:700 ${t*.24}px var(--font);fill:var(--text)">${o??`${Math.round(f)}%`}</text>
  </svg>`
    }

    function tt({
        mode: e = "login",
        error: t = "",
        signup: s = !1
    } = {}) {
        let i = e === "setup",
            o = e === "recover";
        return `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">
      <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" alt="" width="52" height="52">
      <h1>${a(n("app.name"))}</h1>
      <p class="muted" style="margin:0;font-size:12px">${a(n(i?"login.setupTitle":o?"login.recover":"login.title"))}</p>
    </div>
    ${t?`<div class="toast err" style="margin-bottom:12px">${d("alert")} ${a(t)}</div>`:""}
    <form id="auth-form" data-mode="${e}" novalidate>
      ${i?`<div class="field" style="margin-bottom:11px">
          <label for="f-user">${a(n("login.username"))}</label>
          <input id="f-user" name="username" type="text" value="admin" autocomplete="username" dir="ltr">
        </div>`:""}
      ${o?`<div class="field" style="margin-bottom:11px">
          <label for="f-code">\u06A9\u062F \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC</label>
          <input id="f-code" name="code" type="text" autocomplete="one-time-code" dir="ltr" required>
        </div>`:""}
      <div class="field" style="margin-bottom:11px">
        <label for="f-pass">${a(n(o?"login.newPassword":"login.password"))}</label>
        <input id="f-pass" name="password" type="password" autocomplete="${i?"new-password":"current-password"}" required minlength="10" dir="ltr">
      </div>
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">
        ${d(i?"bolt":"key")} ${a(n(i?"login.setup":o?"login.recover":"login.submit"))}
      </button>
      <p class="hint muted" style="font-size:11px;margin-top:12px;text-align:center">${a(n(i?"login.setupHint":"login.hint"))}</p>
      ${!i&&!o?`<p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-recover">${a(n("login.recover"))}</button></p>`:""}
      ${!i&&!o&&s?`<p style="text-align:center;margin:8px 0 0"><button type="button" class="btn btn-sm" data-action="goto-signup">${d("bolt")} ${a(n("signup.button"))}</button></p>`:""}
      ${o?`<p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">\u2192 ${a(n("login.submit"))}</button></p>`:""}
    </form>
  </div></div>`
    }

    function at({
        result: e = null,
        error: t = ""
    } = {}) {
        return e ? `<div class="auth-wrap"><div class="auth-card">
      <div class="auth-logo">
        <div class="omni-cube" style="width:44px;height:44px;margin:0 auto 8px" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <h1>${a(n("signup.doneTitle"))}</h1>
        <p class="muted" style="margin:0;font-size:12px">${a(n("signup.doneSub"))}</p>
      </div>
      <div class="kv"><span>${a(n("users.col.user"))}</span><code>${a(e.username)}</code></div>
      <div class="codebox" style="margin-top:10px"><code id="signup-sub" dir="ltr">${a(e.sub_url)}</code>
        <button class="btn btn-sm" data-action="copy-text" data-text="${a(e.sub_url)}">${a(n("common.copy"))}</button></div>
      <div style="display:flex;justify-content:center;margin:14px 0 4px">${de(e.sub_url,176)}</div>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:6px">
        <a class="btn btn-sm" href="${a(e.status_url)}" target="_blank" rel="noopener">${d("globe")} ${a(n("users.drawer.statusPage"))}</a>
        <a class="btn btn-sm" href="${a(e.sub_url)}" target="_blank" rel="noopener">${d("link")} ${a(n("users.drawer.sub"))}</a>
      </div>
      <p class="hint muted" style="font-size:11px;margin-top:12px;text-align:center">${a(n("signup.hint"))}</p>
      <p style="text-align:center;margin:6px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">${a(n("signup.backLogin"))}</button></p>
    </div></div>` : `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">
      <div class="omni-cube" style="width:44px;height:44px;margin:0 auto 8px" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <h1>${a(n("signup.title"))}</h1>
      <p class="muted" style="margin:0;font-size:12px">${a(n("signup.sub"))}</p>
    </div>
    ${t?`<div class="toast err" style="margin-bottom:12px">${d("alert")} ${a(t)}</div>`:""}
    <ul class="st" style="font-size:13px;line-height:2">
      <li>${a(n("signup.step1"))}</li>
      <li>${a(n("signup.step2"))}</li>
      <li>${a(n("signup.step3"))}</li>
    </ul>
    <button class="btn btn-primary btn-block" type="button" data-action="do-signup" style="margin-top:8px">
      ${d("bolt")} ${a(n("signup.create"))}
    </button>
    <p style="text-align:center;margin:10px 0 0"><button type="button" class="btn btn-ghost btn-sm" data-action="goto-login">${a(n("signup.backLogin"))}</button></p>
  </div></div>`
    }

    function pe(e) {
        if (!e) return `<div class="grid grid-kpi">${Array.from({length:4},()=>'<div class="skeleton" style="height:96px"></div>').join("")}</div>
      <div class="grid grid-2" style="margin-top:14px">${Array.from({length:2},()=>'<div class="skeleton" style="height:240px"></div>').join("")}</div>`;
        let t = e.users || {},
            s = e.cloudflare || {},
            i = Lt(e),
            o = s.pct ?? 0;
        return `
  <div class="grid grid-kpi">
    ${ue({icon:"users",label:n("dash.users"),value:v(t.total||0),sub:`${v(t.active||0)} ${a(n("dash.active"))}`})}
    ${ue({icon:"db",label:n("dash.traffic"),value:D(t.used_bytes||0),sub:`${v(t.requests||0)} req`,tone:"var(--accent-2)"})}
    ${ue({icon:"alert",label:n("dash.expired"),value:v(t.expired||0),sub:i.expiring?`${v(i.expiring)} ${a(n("dash.expiringSoon"))}`:"",tone:t.expired?"var(--danger)":""})}
    ${ue({icon:"bolt",label:n("dash.cf"),value:s.available?`${o}%`:"\u2014",sub:s.available?`${v(s.daily||0)} / ${v(s.limit)}`:a(n("dash.noCf")),tone:o>85?"var(--danger)":o>60?"var(--warn)":"var(--ok)"})}
  </div>

  <div class="grid grid-2" style="margin-top:14px">
    <div class="card">
      <div class="card-head">${d("activity")}<h3>${a(n("dash.traffic7"))}</h3><div class="spacer"></div>
        <div class="legend"><span><i style="background:var(--accent)"></i>\u2193 down</span><span><i style="background:var(--accent-2)"></i>\u2191 up</span></div>
      </div>
      ${et(e.series||[])}
    </div>

    <div class="card">
      <div class="card-head">${d("shield")}<h3>${a(n("dash.alerts"))}</h3></div>
      ${i.list.length?`<div style="display:flex;flex-direction:column;gap:9px">${i.list.map(r=>`<div style="display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:10px;background:color-mix(in srgb, ${r.color} 9%, transparent);border:1px solid color-mix(in srgb, ${r.color} 26%, transparent)">
              <span style="color:${r.color};flex:none;margin-top:2px">${d(r.level==="danger"?"alert":"clock")}</span>
              <div><div style="font-weight:600;font-size:13px">${a(r.title)}</div>
              ${r.detail?`<div class="muted" style="font-size:12px">${a(r.detail)}</div>`:""}</div></div>`).join("")}</div>`:`<div class="empty" style="padding:26px">${d("check")}<div>${a(n("dash.noAlerts"))}</div></div>`}
      ${s.available?`<div style="margin-top:14px;display:flex;align-items:center;gap:14px">
          ${Ae(o,{size:68})}
          <div style="flex:1;min-width:0">
            <div class="kpi-label">${a(n("dash.reqToday"))}</div>
            <div style="font-weight:700;font-size:19px;font-variant-numeric:tabular-nums">${v(s.daily||0)}</div>
            ${$e(o)}
            <div class="kpi-sub">limit ${v(s.limit)}</div>
          </div></div>`:""}
    </div>
  </div>

  <div class="card" style="margin-top:14px">
    <div class="card-head">${d("users")}<h3>${a(n("dash.topUsers"))}</h3><div class="spacer"></div>
      <button class="btn btn-sm" data-action="nav" data-view="users">${a(n("nav.users"))} ${d("chevron")}</button></div>
    ${e.top?.length?`<div style="display:flex;flex-direction:column;gap:10px">${e.top.map(r=>{let c=r.quota_gb?Math.min(100,r.used_bytes/(r.quota_gb*1073741824)*100):0;return`<div>
            <div style="display:flex;gap:10px;align-items:baseline;margin-bottom:4px">
              <a href="#" data-action="open-user" data-user="${a(r.username)}" class="cell-user">${a(r.username)}</a>
              <span class="muted" style="font-size:12px">${D(r.used_bytes)} / ${v(r.quota_gb)} ${a(n("common.gb"))}</span>
              <div class="spacer"></div><span class="muted mono" style="font-size:11px">${c.toFixed(0)}%</span>
            </div>${$e(c)}
          </div>`}).join("")}</div>`:`<div class="empty">${d("users")}<div>${a(n("users.empty"))}</div></div>`}
  </div>`
    }

    function Lt(e) {
        let t = [],
            s = e.cloudflare || {},
            i = 0;
        return s.available && s.pct > 85 && t.push({
            level: "danger",
            color: "var(--danger)",
            title: n("dash.cfDanger"),
            detail: `${s.pct}% \u2014 ${v(s.daily||0)} / ${v(s.limit)}`
        }), {
            list: t,
            expiring: i
        }
    }

    function Ie(e) {
        let t = e.loading ? Xe(8) : (e.users || []).map(s => Pt(s, e.selection.has(s.username))).join("");
        return `
  <div class="toolbar">
    <div class="search" style="flex:1;min-width:190px">${d("search")}
      <input type="search" id="user-search" placeholder="${a(n("users.search"))}" value="${a(e.query)}" data-debounce="300">
    </div>
    <div class="seg" role="group" aria-label="filter">
      ${["all","active","disabled","expired"].map(s=>`<button data-action="filter" data-status="${s}" aria-pressed="${e.status===s}">${a(n(`users.${s==="all"?"all":s==="active"?"activeOnly":s==="disabled"?"disabledOnly":"expiredOnly"}`))}</button>`).join("")}
    </div>
    <button class="btn btn-ghost btn-icon" data-action="refresh-users" title="${a(n("common.refresh"))}">${d("refresh")}</button>
    <button class="btn btn-primary" data-action="new-user">${d("plus")} ${a(n("users.create"))}</button>
  </div>

  ${e.selection.size?`<div class="bulkbar">
        <strong>${v(e.selection.size)}</strong> <span class="muted">${a(n("users.selected"))}</span>
        <div class="spacer"></div>
        <button class="btn btn-sm" data-action="bulk" data-op="enable">${d("check")} ${a(n("users.bulkEnable"))}</button>
        <button class="btn btn-sm" data-action="bulk" data-op="disable">${a(n("users.bulkDisable"))}</button>
        <button class="btn btn-sm" data-action="bulk" data-op="reset_traffic">${d("refresh")} ${a(n("users.bulkReset"))}</button>
        <button class="btn btn-sm" data-action="bulk-extend">${d("clock")} ${a(n("users.bulkExtend"))}</button>
        <button class="btn btn-sm btn-danger" data-action="bulk" data-op="delete">${d("trash")} ${a(n("users.bulkDelete"))}</button>
        <button class="btn btn-ghost btn-sm" data-action="clear-selection">${d("close")}</button>
      </div>`:""}

  <div class="table-wrap">
    <table class="users-table">
      <thead><tr>
        <th style="width:34px"><input type="checkbox" data-action="select-all" ${e.users?.length&&e.selection.size===e.users.length?"checked":""} aria-label="select all"></th>
        <th class="sortable" data-action="sort" data-key="username">${a(n("users.col.user"))}${He(e,"username")}</th>
        <th>${a(n("users.col.status"))}</th>
        <th class="sortable" data-action="sort" data-key="used_bytes" style="min-width:170px">${a(n("users.col.traffic"))}${He(e,"used_bytes")}</th>
        <th class="sortable" data-action="sort" data-key="expires_at">${a(n("users.col.expiry"))}${He(e,"expires_at")}</th>
        <th>${a(n("users.col.devices"))}</th>
        <th style="text-align:end">${a(n("users.col.actions"))}</th>
      </tr></thead>
      <tbody>${t||Ct()}</tbody>
    </table>
    ${e.total>e.size?At(e):""}
  </div>`
    }

    function He(e, t) {
        return e.sort !== t ? "" : ` <span style="opacity:.6">${e.dir==="asc"?"\u25B2":"\u25BC"}</span>`
    }

    function Ct() {
        return `<tr><td colspan="7"><div class="empty">${d("users")}
    <div style="font-weight:600;color:var(--text-dim)">${a(n("users.empty"))}</div>
    <div style="font-size:12px">${a(n("users.emptyHint"))}</div></div></td></tr>`
    }

    function Pt(e, t) {
        let s = e.used_pct || 0;
        return `<tr class="${t?"selected":""}" data-username="${a(e.username)}">
    <td><input type="checkbox" data-action="select-user" data-user="${a(e.username)}" ${t?"checked":""} aria-label="${a(e.username)}"></td>
    <td><a href="#" data-action="open-user" data-user="${a(e.username)}" class="cell-user">${a(e.username)}</a>
      ${e.note?`<div class="muted" style="font-size:11px">${a(e.note)}</div>`:""}</td>
    <td>${Ce(e.status)}</td>
    <td><div style="display:flex;gap:8px;align-items:center">
        <span class="mono" style="font-size:11.5px;min-width:62px">${D(e.used_bytes)}</span>
        <div style="flex:1;min-width:52px">${$e(s,"meter-thin")}</div>
        <span class="muted" style="font-size:11px">${v(e.quota_gb)}GB</span>
      </div></td>
    <td><span class="${e.ms_left!=null&&e.ms_left<864e5*2?"badge warn":"muted"}" style="${e.ms_left!=null&&e.ms_left<864e5*2?"":"font-size:12px"}">${ce(e.ms_left)}</span>
      ${e.first_connect&&!e.activated_at?'<div class="muted" style="font-size:10.5px">\u23F3 first-connect</div>':""}</td>
    <td class="muted">${v(e.device_limit)}</td>
    <td><div class="cell-actions">
      <button class="btn btn-ghost btn-icon" data-action="copy-sub" data-token="${a(e.sub_token)}" title="${a(n("users.drawer.sub"))}">${d("link")}</button>
      <button class="btn btn-ghost btn-icon" data-action="quick-toggle" data-user="${a(e.username)}" data-active="${e.is_active?1:0}" title="${a(n(e.is_active?"users.bulkDisable":"users.bulkEnable"))}">${d(e.is_active?"eye":"check")}</button>
      <button class="btn btn-ghost btn-icon" data-action="edit-user" data-user="${a(e.username)}" title="${a(n("common.edit"))}">${d("edit")}</button>
      <button class="btn btn-ghost btn-icon" data-action="delete-user" data-user="${a(e.username)}" title="${a(n("common.delete"))}" style="color:var(--danger)">${d("trash")}</button>
    </div></td>
  </tr>`
    }

    function At(e) {
        return `<div class="pager">
    <button class="btn btn-sm" data-action="page" data-page="${e.page-1}" ${e.page<=1?"disabled":""}>\u2192</button>
    <span>${v(e.page)} / ${v(e.pages)}</span>
    <button class="btn btn-sm" data-action="page" data-page="${e.page+1}" ${e.page>=e.pages?"disabled":""}>\u2190</button>
  </div>`
    }

    function st(e = {}, t = [], s = []) {
        let i = !!e.username,
            o = (c, f = "") => a(e[c] ?? f),
            r = c => a((c || []).join(`
`));
        return `<form id="user-form" data-edit="${i?a(e.username):""}">
    <div class="form-grid">
      <div class="field"><label for="uf-user">${a(n("users.form.username"))} *</label>
        <input id="uf-user" name="username" type="text" required dir="ltr" ${i?"readonly style='opacity:.6'":""} value="${o("username")}" placeholder="ali-123">
        <span class="hint">${a(n("users.form.usernameHint"))}</span></div>
      <div class="field"><label for="uf-quota">${a(n("users.form.quota"))}</label>
        <input id="uf-quota" name="quota_gb" type="number" min="0.1" step="0.5" value="${o("quota_gb",50)}"></div>
      <div class="field"><label for="uf-days">${a(n("users.form.days"))}</label>
        <input id="uf-days" name="expiry_days" type="number" min="1" value="${o("expiry_days",30)}"></div>
      <div class="field"><label for="uf-dev">${a(n("users.form.devices"))}</label>
        <input id="uf-dev" name="device_limit" type="number" min="1" max="50" value="${o("device_limit",3)}"></div>
      <div class="field"><label for="uf-req">${a(n("users.form.requests"))}</label>
        <input id="uf-req" name="request_limit" type="number" min="0" value="${o("request_limit",0)}"></div>
      <div class="field"><label for="uf-frag">${a(n("users.form.fragment"))}</label>
        <select id="uf-frag" name="fragment">
          ${t.map(c=>`<option value="${a(c.id)}" ${e.fragment===c.id?"selected":""}>${a(c.label)}</option>`).join("")}
        </select></div>
      <div class="field"><label for="uf-fp">${a(n("users.form.fingerprint"))}</label>
        <select id="uf-fp" name="fingerprint">
          <option value="">\u2014</option>
          ${s.map(c=>`<option value="${a(c)}" ${e.fingerprint===c?"selected":""}>${a(c)}</option>`).join("")}
        </select></div>
      <div class="field"><label style="display:flex;align-items:center;gap:9px;padding-top:22px">
        <label class="switch"><input type="checkbox" name="first_connect" ${e.first_connect!==!1?"checked":""}><span></span></label>
        <span>${a(n("users.form.firstConnect"))}</span></label></div>
      <div class="field"><label style="display:flex;align-items:center;gap:9px">
        <label class="switch"><input type="checkbox" name="is_active" ${e.is_active!==!1?"checked":""}><span></span></label>
        <span>${a(n("users.form.active"))}</span></label></div>
    </div>
    <div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">
      <div class="field"><label for="uf-ips">${a(n("users.form.ips"))}</label>
        <textarea id="uf-ips" name="ips" rows="3" placeholder="104.16.0.0">${r(e.ips)}</textarea></div>
      <div class="field"><label for="uf-proxy">${a(n("users.form.proxies"))}</label>
        <textarea id="uf-proxy" name="proxies" rows="3" placeholder="user:pass@1.2.3.4:1080">${r(e.proxies)}</textarea></div>
      <div class="field"><label for="uf-block">${a(n("users.form.blockList"))}</label>
        <textarea id="uf-block" name="block_list" rows="3" placeholder="example.com">${r(e.block_list)}</textarea></div>
    </div>
    <div class="field"><label for="uf-note">${a(n("users.form.note"))}</label>
      <input id="uf-note" name="note" type="text" maxlength="200" value="${o("note")}" style="font-family:var(--font)"></div>
  </form>`
    }

    function De(e, t, s = []) {
        let i = `${location.origin}${le(e.sub_token)}`,
            o = `${location.origin}/status/${e.sub_token}`,
            r = (s || []).map(c => ({
                ...c,
                total: (c.up_bytes || 0) + (c.down_bytes || 0)
            }));
        return `
  <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
    ${Ce(e.status)}
    <span class="badge">${v(e.device_limit)} ${a(n("users.col.devices"))}</span>
    <span class="badge">${a(e.fragment||"\u2014")}</span>
    ${e.fingerprint?`<span class="badge">${a(e.fingerprint)}</span>`:""}
  </div>

  <div style="display:flex;gap:14px;align-items:center;margin-top:4px">
    ${Ae(e.used_pct,{size:78})}
    <div style="flex:1;min-width:0">
      <div class="kpi-label">${a(n("users.col.traffic"))}</div>
      <div style="font-weight:800;font-size:19px">${D(e.used_bytes)} <span class="muted" style="font-size:12px;font-weight:400">/ ${v(e.quota_gb)} GB</span></div>
      <div class="kpi-sub">${a(n("users.col.expiry"))}: ${ce(e.ms_left)}${e.expires_at?` \xB7 ${Ke(e.expires_at)}`:""}</div>
    </div>
  </div>

  <div class="tabs" role="tablist" style="margin-top:8px">
    <button role="tab" aria-selected="true" data-action="drawer-tab" data-tab="qr">${d("qr")} ${a(n("users.drawer.qr"))}</button>
    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="configs">${a(n("users.drawer.configs"))}</button>
    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="usage">${a(n("users.drawer.usage"))}</button>
    <button role="tab" aria-selected="false" data-action="drawer-tab" data-tab="sub">${a(n("users.drawer.sub"))}</button>
  </div>

  <div data-tab-panel="qr">
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <div class="qr">${de(t.uris?.[0]||"")}</div>
      <div style="flex:1;min-width:190px">
        <div class="kpi-label" style="margin-bottom:5px">vless://</div>
        <div class="codebox" style="max-height:120px">${a(t.uris?.[0]||"")}</div>
        <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap">
          ${te(t.uris?.[0]||"")}
          <button class="btn btn-sm" data-action="copy-all-uris">${d("copy")} ${a(t.uris?.length||0)}\xD7</button>
        </div>
        <div class="livetest">
          <button class="btn btn-sm" data-action="live-test" data-uuid="${a(e.uuid)}" data-host="${a(t.host||"")}">${d("activity")} ${a(n("users.drawer.liveTest"))}</button>
          <span class="ms" data-lt-ms hidden>\u2014</span>
          <span class="muted" data-lt-msg style="font-size:11.5px;flex:1;min-width:120px">${a(n("live.hint"))}</span>
        </div>
      </div>
    </div>
    ${(t.uris||[]).length>1?`<div class="kpi-label" style="margin:14px 0 7px">${v(t.uris.length)} \u0644\u0648\u06A9\u06CC\u0634\u0646</div>
      <div style="display:flex;flex-direction:column;gap:7px">${t.uris.map((c,f)=>`<div style="display:flex;gap:8px;align-items:center"><span class="badge info">#${f+1}</span>
         <div class="codebox" style="flex:1;max-height:44px;font-size:10.5px">${a(c)}</div>
         ${te(c,"",!0)}</div>`).join("")}</div>`:""}
  </div>

  <div data-tab-panel="configs" class="hide">
    <div class="seg" style="margin-bottom:10px">
      <button data-action="cfg-format" data-format="singbox" aria-pressed="true">sing-box</button>
      <button data-action="cfg-format" data-format="clash" aria-pressed="false">Clash</button>
      <button data-action="cfg-format" data-format="base64" aria-pressed="false">Base64</button>
    </div>
    <pre class="codebox" id="cfg-out" style="max-height:340px">${a(JSON.stringify(t.singbox,null,2))}</pre>
    <div style="display:flex;gap:7px;margin-top:9px">
      <button class="btn btn-sm" data-action="copy-cfg">${d("copy")} ${a(n("common.copy"))}</button>
      <button class="btn btn-sm" data-action="download-cfg">${d("download")} \u062F\u0627\u0646\u0644\u0648\u062F</button>
    </div>
  </div>

  <div data-tab-panel="usage" class="hide">
    ${r.length?Pe(r,{valueKey:"total",height:170}):` < div class = "empty" > $ {
            d("activity")
        } < div > no usage yet < /div></div > `}
    ${r.length?`<div class="table-wrap" style="margin-top:10px"><table><thead><tr>
        <th>\u0631\u0648\u0632</th><th>\u2193</th><th>\u2191</th><th>\u0627\u062A\u0635\u0627\u0644</th></tr></thead><tbody>
      ${r.slice().reverse().slice(0,14).map(c=>`<tr><td class="mono">${a(c.day)}</td><td class="mono">${D(c.down_bytes)}</td><td class="mono">${D(c.up_bytes)}</td><td class="mono">${v(c.conns)}</td></tr>`).join("")}
      </tbody></table></div>`:""}
  </div>

  <div data-tab-panel="sub" class="hide">
    <div class="field"><label>${a(n("users.drawer.sub"))}</label>
      <div class="codebox" id="sub-link">${a(i)}</div>
      <div style="display:flex;gap:7px;margin-top:8px;flex-wrap:wrap">
        ${te(i)}
        <a class="btn btn-sm" href="${a(o)}" target="_blank" rel="noopener">${d("globe")} ${a(n("users.drawer.statusPage"))}</a>
        <button class="btn btn-sm" data-action="rotate-token">${d("refresh")} ${a(n("users.drawer.rotateToken"))}</button>
        <button class="btn btn-sm" data-action="rotate-uuid">${d("key")} ${a(n("users.drawer.rotateUuid"))}</button>
      </div>
    </div>
    <p class="hint muted" style="font-size:11.5px;margin-top:10px">
      UUID: <span class="mono">${a(e.uuid)}</span>
    </p>
  </div>

  <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
    <button class="btn btn-sm" data-action="edit-user" data-user="${a(e.username)}">${d("edit")} ${a(n("common.edit"))}</button>
    <button class="btn btn-sm" data-action="reset-user" data-user="${a(e.username)}">${d("refresh")} ${a(n("users.drawer.reset"))}</button>
    <div class="spacer"></div>
    <button class="btn btn-sm btn-danger" data-action="delete-user" data-user="${a(e.username)}">${d("trash")} ${a(n("common.delete"))}</button>
  </div>`
    }

    function qe(e, t = [], s = []) {
        let i = (c, f = "") => a(e[c] ?? f),
            o = c => e[c] === "1" || e[c] === !0 ? "checked" : "",
            r = c => {
                let f = e[c],
                    u = Array.isArray(f) ? f : [];
                if (typeof f == "string" && f.trim()) try {
                    u = JSON.parse(f)
                } catch {
                    u = f.split(/[\n,]/)
                }
                return a((u || []).join(`
`))
            };
        return `<form id="settings-form">
  <div class="grid grid-2">
    <div class="card">
      <div class="card-head">${d("gear")}<h3>${a(n("settings.general"))}</h3></div>
      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field"><label>${a(n("settings.panelName"))}</label><input name="panel_name" type="text" value="${i("panel_name","Kaveh")}"></div>
        <div class="field"><label>${a(n("settings.publicHost"))}</label><input name="public_host" type="text" dir="ltr" value="${i("public_host")}" placeholder="panel.example.workers.dev">
          <span class="hint">SNI/Host \u06A9\u0647 \u06A9\u0644\u0627\u06CC\u0646\u062A \u0645\u06CC\u200C\u0641\u0631\u0633\u062A\u062F. \u0627\u06AF\u0631 \u062E\u0627\u0644\u06CC \u0628\u0627\u0634\u062F\u060C \u062F\u0627\u0645\u0646\u0647\u200C\u06CC \u0648\u0631\u06A9\u0631 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.</span></div>
        <div class="field"><label>${a(n("settings.remark"))}</label><input name="remark_prefix" type="text" value="${i("remark_prefix","Kaveh")}"></div>
        <div style="display:flex;gap:11px">
          <div class="field" style="flex:1"><label>${a(n("settings.defaultQuota"))}</label><input name="default_quota_gb" type="number" min="1" value="${i("default_quota_gb","50")}"></div>
          <div class="field" style="flex:1"><label>${a(n("settings.defaultDays"))}</label><input name="default_expiry_days" type="number" min="1" value="${i("default_expiry_days","30")}"></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="maintenance" ${o("maintenance")}><span></span></label>
          <span>${a(n("settings.maintenance"))}</span></div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="public_signup" ${o("public_signup")}><span></span></label>
          <span>${a(n("signup.settingToggle"))}</span></div>
        <div class="field" style="max-width:180px"><label>${a(n("signup.maxPerIp"))}</label>
          <input name="signup_max_per_ip" type="number" min="1" max="100" value="${i("signup_max_per_ip","3")}"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">${d("wifi")}<h3>${a(n("settings.network"))}</h3></div>
      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field"><label>${a(n("settings.port"))}</label>
          <select name="port">${[443,2053,2083,2087,2096,8443,80,8080,2052,2082,2086,2095].map(c=>`<option value="${c}" ${String(e.port)===String(c)?"selected":""}>${c}${[443,2053,2083,2087,2096,8443].includes(c)?" (TLS)":""}</option>`).join("")}</select></div>
        <div class="field"><label>${a(n("users.form.fragment"))}</label>
          <select name="fragment_preset">${t.map(c=>`<option value="${a(c.id)}" ${e.fragment_preset===c.id?"selected":""}>${a(c.label)}</option>`).join("")}</select></div>
        <div class="field"><label>${a(n("users.form.fingerprint"))}</label>
          <select name="fingerprint"><option value="">\u2014</option>${s.map(c=>`<option value="${a(c)}" ${e.fingerprint===c?"selected":""}>${a(c)}</option>`).join("")}</select></div>
        <div class="field"><label>${a(n("settings.cleanIps"))}</label>
          <textarea name="clean_ips" rows="3" dir="ltr">${r("clean_ips")}</textarea></div>
        <div class="field"><label>${a(n("settings.ipPool"))}</label>
          <textarea name="ip_pool" rows="4" dir="ltr" placeholder="104.16.0.0&#10;172.66.0.0">${r("ip_pool")}</textarea>
          <span class="hint">\u0645\u062E\u0632\u0646\u06CC \u06A9\u0647 Cron \u0647\u0631 ${a(e.rotate_minutes||30)} \u062F\u0642\u06CC\u0642\u0647 \u0627\u0632 \u0622\u0646 \u062A\u0633\u062A \u0645\u06CC\u200C\u06AF\u06CC\u0631\u062F \u0648 \u0628\u0647\u062A\u0631\u06CC\u0646\u200C\u0647\u0627 \u0631\u0627 \u062F\u0631 \xAB\u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632 \u0641\u0639\u0644\u06CC\xBB \u0645\u06CC\u200C\u06AF\u0630\u0627\u0631\u062F.</span></div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="auto_rotate" ${o("auto_rotate")}><span></span></label><span>${a(n("settings.autoRotate"))}</span>
          <input name="rotate_minutes" type="number" min="5" max="1440" value="${i("rotate_minutes","30")}" style="width:88px"></div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="mux_enabled" ${o("mux_enabled")}><span></span></label><span>${a(n("settings.mux"))}</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">${d("shield")}<h3>${a(n("settings.security"))}</h3></div>
      <div style="display:flex;flex-direction:column;gap:11px">
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="block_nsfw" ${o("block_nsfw")}><span></span></label><span>${a(n("settings.blockNsfw"))}</span></div>
        <div style="display:flex;align-items:center;gap:10px">
          <label class="switch"><input type="checkbox" name="block_ads" ${o("block_ads")}><span></span></label><span>${a(n("settings.blockAds"))}</span></div>
        <p class="hint muted" style="font-size:11.5px;margin:0">
          \u0645\u0633\u062F\u0648\u062F\u0633\u0627\u0632\u06CC \u0631\u0648\u06CC \u0644\u0628\u0647 \u0648 \u0628\u0627 DoH \u0627\u0646\u062C\u0627\u0645 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0641\u0647\u0631\u0633\u062A \u062F\u0627\u0645\u0646\u0647\u200C\u0647\u0627 \u062F\u0631 \u0647\u0631 \u06A9\u0627\u0631\u0628\u0631 \u0647\u0645 \u0642\u0627\u0628\u0644 \u062A\u0646\u0638\u06CC\u0645 \u0627\u0633\u062A.</p>
        <div class="nav-sep"></div>
        <div class="field"><label>${a(n("settings.changePassword"))}</label>
          <input name="pw_current" type="password" placeholder="${a(n("settings.currentPassword"))}" autocomplete="current-password" dir="ltr">
          <input name="pw_next" type="password" placeholder="${a(n("login.newPassword"))}" autocomplete="new-password" dir="ltr" minlength="10" style="margin-top:7px">
          <button class="btn btn-sm" type="button" data-action="change-password" style="margin-top:9px;align-self:flex-start">${d("key")} ${a(n("settings.changePassword"))}</button></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">${d("db")}<h3>${a(n("settings.backup"))}</h3></div>
      <p class="hint muted" style="font-size:12px;margin-top:0">
        \u062E\u0631\u0648\u062C\u06CC \u06A9\u0627\u0645\u0644 D1 \u0628\u0647 JSON \u2014 \u06A9\u0627\u0631\u0628\u0631\u0627\u0646\u060C \u062A\u0646\u0638\u06CC\u0645\u0627\u062A\u060C \u067E\u0644\u0646\u200C\u0647\u0627 \u0648 \u0646\u0648\u062F\u0647\u0627. \u0628\u0631\u0627\u06CC \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0628\u06CC\u0646 \u0627\u06A9\u0627\u0646\u062A \u06A9\u0644\u0648\u062F\u0641\u0644\u0631 \u06CC\u0627 \u0641\u0631\u0627\u0631 \u0627\u0632 \u0628\u0646 \u0634\u062F\u0646.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" type="button" data-action="export-backup">${d("download")} ${a(n("settings.export"))}</button>
        <label class="btn" style="cursor:pointer">${d("upload")} ${a(n("settings.import"))}
          <input type="file" accept="application/json" data-action="import-backup" hidden></label>
      </div>
      <div class="nav-sep" style="margin:16px 0"></div>
      <div class="card-head" style="color:var(--danger)">${d("alert")}<h3 style="color:var(--danger)">${a(n("settings.danger"))}</h3></div>
      <button class="btn btn-danger" type="button" data-action="revoke-all">${d("logout")} \u062E\u0631\u0648\u062C \u0627\u0632 \u0647\u0645\u0647 \u0646\u0634\u0633\u062A\u200C\u0647\u0627</button>
    </div>
  </div>

  <div style="position:sticky;bottom:0;margin-top:14px;display:flex;gap:9px;justify-content:flex-end;padding:12px;
    background:color-mix(in srgb, var(--surface) 88%, transparent);backdrop-filter:blur(10px);border:1px solid var(--border);border-radius:var(--radius)">
    <button class="btn" type="button" data-action="reload-settings">${a(n("common.cancel"))}</button>
    <button class="btn btn-primary" type="submit">${d("check")} ${a(n("settings.save"))}</button>
  </div>
  </form>`
    }

    function Ue(e = []) {
        return `<div class="grid grid-2">
    <div class="card">
      <div class="card-head">${d("wifi")}<h3>${a(n("diag.probeNode"))}</h3></div>
      <div class="field"><input id="probe-input" type="text" dir="ltr" placeholder="${a(n("diag.probeHint"))}">
        <span class="hint">${a(n("diag.probeHint"))}</span></div>
      <button class="btn btn-primary btn-sm" data-action="probe" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>
      <div id="probe-out" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-head">${d("bolt")}<h3>${a(n("diag.rankIps"))}</h3></div>
      <div class="field"><textarea id="rank-input" rows="4" dir="ltr" placeholder="104.16.0.0&#10;172.66.0.0"></textarea>
        <span class="hint">${a(n("diag.rankHint"))}</span></div>
      <button class="btn btn-primary btn-sm" data-action="rank" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>
      <div id="rank-out" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-head">${d("activity")}<h3>${a(n("diag.ping"))}</h3></div>
      <div class="field"><input id="ping-input" type="text" dir="ltr" value="https://cp.cloudflare.com"></div>
      <button class="btn btn-primary btn-sm" data-action="ping" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>
      <div id="ping-out" style="margin-top:12px"></div>
    </div>

    <div class="card">
      <div class="card-head">${d("refresh")}<h3>${a(n("diag.maintenance"))}</h3></div>
      <p class="hint muted" style="margin-top:-4px">${a(n("diag.maintenanceHint"))}</p>
      <button class="btn btn-primary btn-sm" data-action="maintenance" style="margin-top:10px">${d("play")} ${a(n("diag.run"))}</button>
      <div id="maintenance-out" style="margin-top:12px"></div>
    </div>

    <div class="card" style="grid-column:1/-1">
      <div class="card-head">${d("shield")}<h3>${a(n("diag.audit"))}</h3><div class="spacer"></div>
        <button class="btn btn-ghost btn-sm" data-action="reload-logs">${d("refresh")}</button></div>
      <p class="hint muted" style="margin-top:-6px;font-size:11.5px">${a(n("diag.auditHint"))}</p>
      <div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr>
        <th>\u0632\u0645\u0627\u0646</th><th>\u0628\u0627\u0632\u06CC\u06AF\u0631</th><th>\u0631\u0648\u06CC\u062F\u0627\u062F</th><th>\u0647\u062F\u0641</th></tr></thead>
        <tbody>${(e||[]).map(t=>`<tr>
          <td class="muted" style="white-space:nowrap">${ye(t.at)}</td>
          <td class="mono" style="font-size:11.5px">${a(t.actor)}</td>
          <td><span class="badge ${/delete|failed|revoke/.test(t.action)?"danger":/create|update|login$/.test(t.action)?"info":""}">${a(t.action)}</span></td>
          <td class="muted mono" style="font-size:11.5px">${a(t.target||"")}</td></tr>`).join("")||'<tr><td colspan="4"><div class="empty">\u2014</div></td></tr>'}</tbody></table></div>
    </div>
  </div>`
    }

    function Ne(e = []) {
        return `<div class="card">
    <div class="card-head">${d("key")}<h3>${a(n("nav.sessions"))}</h3><div class="spacer"></div>
      <button class="btn btn-sm btn-danger" data-action="revoke-all">${a(n("settings.danger"))}</button></div>
    <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Role</th><th>\u0627\u06CC\u062C\u0627\u062F</th><th>\u0627\u0646\u0642\u0636\u0627</th><th>IP</th><th></th></tr></thead>
    <tbody>${e.map(t=>`<tr>
      <td class="cell-user">${a(t.subject)}</td><td><span class="badge info">${a(t.role)}</span></td>
      <td class="muted">${ye(t.created_at)}</td><td class="muted">${ce(t.expires_at-Date.now())}</td>
      <td class="mono muted" style="font-size:11px">${a((t.ip_hash||"").slice(0,8))}</td>
      <td style="text-align:end"><button class="btn btn-ghost btn-sm" data-action="revoke-session" data-id="${a(t.id)}">${d("close")}</button></td>
    </tr>`).join("")||'<tr><td colspan="6"><div class="empty">\u2014</div></td></tr>'}</tbody></table></div>
  </div>`
    }
    var ot = [{
            id: "omni",
            label: "\u0627\u0648\u0645\u0646\u06CC (\u0644\u0627\u0645\u0628\u0648)",
            a: "#ffc000",
            b: "#ffffff"
        }, {
            id: "dark",
            label: "\u06A9\u0627\u0648\u0647 \u062A\u06CC\u0631\u0647",
            a: "#22d3ee",
            b: "#a78bfa"
        }, {
            id: "light",
            label: "\u06A9\u0627\u0648\u0647 \u0631\u0648\u0634\u0646",
            a: "#0ea5e9",
            b: "#8b5cf6"
        }, {
            id: "ferrari",
            label: "\u0641\u0631\u0627\u0631\u06CC",
            a: "#da291c",
            b: "#fff200"
        }, {
            id: "apple",
            label: "\u0627\u067E\u0644",
            a: "#0066cc",
            b: "#2997ff"
        }, {
            id: "claude",
            label: "\u06A9\u0644\u0648\u062F",
            a: "#cc785c",
            b: "#5db8a6"
        }, {
            id: "pinterest",
            label: "\u067E\u06CC\u0646\u062A\u0631\u0633\u062A",
            a: "#e60023",
            b: "#7e238b"
        }, {
            id: "nintendo",
            label: "\u0646\u06CC\u0646\u062A\u0646\u062F\u0648",
            a: "#e60012",
            b: "#f68d1f"
        }, {
            id: "dell",
            label: "\u062F\u0644",
            a: "#e91d2a",
            b: "#fcc20f"
        }],
        we = [443, 2053, 2083, 2087, 2096, 8443],
        Ht = [80, 8080, 8880, 2052, 2082, 2086, 2095],
        It = ["2606:4700::6810:84e5", "2606:4700::6812:1a2e", "2606:4700:3030::ac43:b58a", "2606:4700:3032::6815:3ef9"],
        rt = ["104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "162.158.0.0/15", "141.101.64.0/18", "108.162.192.0/18", "188.114.96.0/20", "103.21.244.0/22", "190.93.240.0/20", "198.41.128.0/17"],
        Dt = ["proxyip.cmliussss.net", "di.nscl.ir", "tr.diam4.ggff.net"],
        lt = [
            ["FRA", "\u{1F1E9}\u{1F1EA}"],
            ["AMS", "\u{1F1F3}\u{1F1F1}"],
            ["LHR", "\u{1F1EC}\u{1F1E7}"],
            ["CDG", "\u{1F1EB}\u{1F1F7}"],
            ["IST", "\u{1F1F9}\u{1F1F7}"],
            ["DXB", "\u{1F1E6}\u{1F1EA}"],
            ["IAD", "\u{1F1FA}\u{1F1F8}"],
            ["LAX", "\u{1F1FA}\u{1F1F8}"],
            ["SIN", "\u{1F1F8}\u{1F1EC}"],
            ["NRT", "\u{1F1EF}\u{1F1F5}"],
            ["BOM", "\u{1F1EE}\u{1F1F3}"],
            ["GRU", "\u{1F1E7}\u{1F1F7}"]
        ],
        nt = "VLESS \u25C6 TROJAN \u25C6 WEBSOCKET \u25C6 DoH \u25C6 WARP \u25C6 CLOUDFLARE \u25C6 ",
        qt = ["104.16.132.229", "172.67.181.32", "188.114.96.1", "162.159.192.1", "104.17.148.22", "172.64.80.1", "104.16.0.1", "172.64.0.1", "162.158.0.1", "141.101.90.1", "108.162.192.1", "103.21.244.1"],
        Ut = [{
            name: "Shecan (\u0627\u06CC\u0631\u0627\u0646)",
            url: "https://178.22.122.100/dns-query",
            dot: "shecan.ir",
            ir: !0
        }, {
            name: "Electro (\u0627\u06CC\u0631\u0627\u0646)",
            url: "https://78.157.42.100/dns-query",
            dot: "electrotm.org",
            ir: !0
        }, {
            name: "Radar (\u0627\u06CC\u0631\u0627\u0646)",
            url: "https://10.202.10.10/dns-query",
            dot: "radar.game",
            ir: !0
        }, {
            name: "403.online (\u0627\u06CC\u0631\u0627\u0646)",
            url: "https://10.202.10.202/dns-query",
            dot: "403.online",
            ir: !0
        }, {
            name: "Begzar (\u0627\u06CC\u0631\u0627\u0646)",
            url: "https://185.55.226.26/dns-query",
            dot: "begzar.ir",
            ir: !0
        }, {
            name: "AliDNS",
            url: "https://223.5.5.5/dns-query",
            dot: "dns.alidns.com"
        }, {
            name: "Yandex",
            url: "https://77.88.8.8/dns-query",
            dot: "common.dot.dns.yandex.net"
        }, {
            name: "Cloudflare",
            url: "https://cloudflare-dns.com/dns-query",
            dot: "one.one.one.one"
        }, {
            name: "Google",
            url: "https://dns.google/dns-query",
            dot: "dns.google"
        }, {
            name: "Quad9",
            url: "https://dns.quad9.net/dns-query",
            dot: "dns.quad9.net"
        }, {
            name: "AdGuard",
            url: "https://dns.adguard-dns.com/dns-query",
            dot: "dns.adguard-dns.com"
        }, {
            name: "Mullvad",
            url: "https://dns.mullvad.net/dns-query",
            dot: "dns.mullvad.net"
        }, {
            name: "ControlD",
            url: "https://freedns.controld.com/p0",
            dot: "p0.freedns.controld.com"
        }],
        Nt = e => btoa(unescape(encodeURIComponent(e)));

    function Re(e) {
        if (Array.isArray(e)) return e.filter(Boolean);
        try {
            let t = JSON.parse(e || "[]");
            return Array.isArray(t) ? t.filter(Boolean) : []
        } catch {
            return String(e || "").split(/[,\s]+/).filter(Boolean)
        }
    }

    function Oe(e) {
        let t = new Set,
            s = [];
        for (let i of [Re(e?.clean_ips), Re(e?.ip_pool), qt])
            for (let o of i) {
                let r = String(o).trim();
                r && !t.has(r) && (t.add(r), s.push(r))
            }
        return s.slice(0, 32)
    }

    function Rt(e, t) {
        let s = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(e.trim());
        if (!s) return [];
        let [, i, o, r, c, f] = s.map(Number), u = f;
        if (u < 8 || u > 32) return [];
        let m = (i << 24 | o << 16 | r << 8 | c) >>> 0,
            p = 2 ** (32 - u),
            $ = Math.max(1, Math.floor(p / t)),
            M = [];
        for (let k = 0; k < p && M.length < t; k += $) {
            let L = m + k >>> 0;
            M.push(`${L>>>24}.${L>>>16&255}.${L>>>8&255}.${L&255}`)
        }
        return M
    }

    function Ot(e) {
        return we.includes(Number(e)) ? `${e}\xB7TLS` : `${e}`
    }

    function jt(e) {
        let t = e.getContext && e.getContext("2d");
        if (!t) return;
        let s = matchMedia("(prefers-reduced-motion: reduce)").matches,
            i = 0,
            o = 0,
            r = 1,
            c = () => {
                r = Math.min(2, devicePixelRatio || 1), i = e.clientWidth, o = e.clientHeight, e.width = i * r, e.height = o * r, t.setTransform(r, 0, 0, r, 0, 0)
            };
        c(), addEventListener("resize", c, {
            passive: !0
        });
        let f = Array.from({
                length: 90
            }, () => ({
                x: Math.random(),
                y: Math.random(),
                r: Math.random() * 1.2 + .3,
                p: Math.random() * 6.28
            })),
            u = (1 + Math.sqrt(5)) / 2,
            m = [
                [-1, u, 0],
                [1, u, 0],
                [-1, -u, 0],
                [1, -u, 0],
                [0, -1, u],
                [0, 1, u],
                [0, -1, -u],
                [0, 1, -u],
                [u, 0, -1],
                [u, 0, 1],
                [-u, 0, -1],
                [-u, 0, 1]
            ].map(T => {
                let _ = Math.hypot(...T);
                return T.map(I => I / _)
            }),
            p = [];
        for (let T = 0; T < 12; T++)
            for (let _ = T + 1; _ < 12; _++) Math.hypot(m[T][0] - m[_][0], m[T][1] - m[_][1], m[T][2] - m[_][2]) < 1.2 && p.push([T, _]);
        let $ = getComputedStyle(document.documentElement),
            M = () => $.getPropertyValue("--accent").trim() || "#ffc000",
            k = () => $.getPropertyValue("--text").trim() || "#fff";

        function L(T, _, I) {
            let [j, F, N] = T, V = Math.cos(_), G = Math.sin(_), ie = Math.cos(I), ve = Math.sin(I), _e = j * V + N * G, he = -j * G + N * V, We = F * ie - he * ve, K = F * ve + he * ie;
            return [_e, We, K]
        }

        function S(T, _, I, j) {
            let N = 2.6 / (2.6 + T[2]);
            return [I + T[0] * _ * N, j + T[1] * _ * N, N]
        }
        let C = 0,
            q = performance.now(),
            Ze = 0;

        function be(T) {
            let _ = (T - q) / 1e3;
            if (T - Ze < 33) {
                C = requestAnimationFrame(be);
                return
            }
            Ze = T, t.clearRect(0, 0, i, o);
            let I = i / 2,
                j = o / 2,
                F = Math.min(i, o) * .36;
            for (let w of f) {
                let E = .25 + .55 * Math.abs(Math.sin(_ / 1.6 + w.p));
                t.fillStyle = k(), t.globalAlpha = E * .5, t.beginPath(), t.arc(w.x * i, w.y * o, w.r, 0, 6.28), t.fill()
            }
            t.globalAlpha = 1;
            let N = _ * .32,
                V = Math.sin(_ / 5) * .35 + .25,
                G = M();
            t.strokeStyle = G, t.globalAlpha = .28, t.lineWidth = 1;
            for (let w = -60; w <= 60; w += 30) {
                t.beginPath();
                for (let E = 0; E <= 360; E += 6) {
                    let z = w * Math.PI / 180,
                        Z = E * Math.PI / 180,
                        ee = L([Math.cos(z) * Math.sin(Z), Math.sin(z), Math.cos(z) * Math.cos(Z)], N, V),
                        [oe, re] = S(ee, F, I, j);
                    E === 0 ? t.moveTo(oe, re) : t.lineTo(oe, re)
                }
                t.stroke()
            }
            for (let w = 0; w < 360; w += 30) {
                t.beginPath();
                for (let E = -90; E <= 90; E += 6) {
                    let z = E * Math.PI / 180,
                        Z = w * Math.PI / 180,
                        ee = L([Math.cos(z) * Math.sin(Z), Math.sin(z), Math.cos(z) * Math.cos(Z)], N, V),
                        [oe, re] = S(ee, F, I, j);
                    E === -90 ? t.moveTo(oe, re) : t.lineTo(oe, re)
                }
                t.stroke()
            }
            t.globalAlpha = .85, t.lineWidth = 1.6, t.beginPath();
            for (let w = 0; w <= 120; w++) {
                let E = w / 120 * 6.28,
                    z = L([Math.cos(E) * 1.45, Math.sin(E) * .32, 0], N + .6, V + .5),
                    [Z, ee] = S(z, F, I, j);
                w === 0 ? t.moveTo(Z, ee) : t.lineTo(Z, ee)
            }
            t.stroke();
            let ie = _ * 1.1,
                ve = L([Math.cos(ie) * 1.45, Math.sin(ie) * .32, 0], N + .6, V + .5),
                [_e, he] = S(ve, F, I, j);
            t.fillStyle = G, t.beginPath(), t.arc(_e, he, 3.2, 0, 6.28), t.fill();
            let K = m.map(w => L(w.map(E => E * .52), -N * 1.6, -V * 1.2)).map(w => S(w, F, I, j));
            t.globalAlpha = .16, t.fillStyle = G, t.beginPath(), t.arc(I, j, F * .62, 0, 6.28), t.fill(), t.globalAlpha = .9, t.strokeStyle = G, t.lineWidth = 1.6;
            for (let [w, E] of p) t.beginPath(), t.moveTo(K[w][0], K[w][1]), t.lineTo(K[E][0], K[E][1]), t.stroke();
            t.globalAlpha = .95, t.fillStyle = G;
            for (let w of K) t.beginPath(), t.arc(w[0], w[1], 2, 0, 6.28), t.fill();
            t.globalAlpha = 1, s || (C = requestAnimationFrame(be))
        }
        s ? be(performance.now()) : C = requestAnimationFrame(be)
    }
    async function Ft() {
        let e = document.querySelector("#omni-colo");
        if (e) try {
            let s = await (await fetch("/cdn-cgi/trace", {
                    cache: "no-store"
                })).text(),
                i = /colo=(\w+)/.exec(s)?.[1],
                o = /ip=([^\s]+)/.exec(s)?.[1],
                r = (lt.find(([c]) => c === i) || [])[1] || "\u{1F310}";
            e.textContent = `${r} ${i||"\u2014"}${o?" \xB7 "+o:""}`
        } catch {
            e.textContent = location.hostname.endsWith(".workers.dev") ? "\u{1F310} \u2014" : `${a(n("omni.localMode"))}`
        }
    }

    function ke(e, t) {
        let s = e || {},
            i = t && t.users || {},
            o = Re(s.clean_ips);
        return setTimeout(() => {
            let r = document.querySelector("#omni-globe");
            r && jt(r), Ft()
        }, 0), `
  <section class="omni-hero">
    <div class="omni-hero-top">
      <div class="omni-id">
        <h1>OMNI PANEL</h1>
        <p>${a(n("omni.heroTag"))}</p>
        <span class="omni-pill">${a(n("omni.online"))}</span>
      </div>
      <canvas id="omni-globe" class="omni-globe" aria-hidden="true"></canvas>
    </div>
    <div class="omni-badges">
      <span>VLESS-WS</span><span>Trojan-WS</span><span>DoH</span><span>WARP</span><span>${v(o.length)} IP</span><span>Kaveh v0.1.0</span>
    </div>
    <div class="omni-stats">
      <div><span>${a(n("omni.statSni"))}</span><b>${a(s.public_host||"\u2014")}</b></div>
      <div><span>${a(n("omni.statColo"))}</span><b id="omni-colo">\u2026</b></div>
      <div><span>${a(n("omni.statPorts"))}</span><b>${we.slice(0,4).join(" \xB7 ")}</b></div>
      <div><span>${a(n("omni.statUsers"))}</span><b>${i.total!=null?v(i.total):"\u2026"}</b></div>
    </div>
    <div class="omni-flags" aria-hidden="true">
      ${lt.map(([r,c])=>`<span title="${r}">${c}</span>`).join("")}
    </div>
  </section>
  <div class="omni-tick" aria-hidden="true"><span>${nt.repeat(4)}</span><span>${nt.repeat(4)}</span></div>`
    }
    var g = {
        user: "",
        ports: [443, 2053],
        protos: ["vless", "trojan"],
        addrs: "clean",
        customAddr: "",
        fp: "chrome",
        fragment: !1,
        ipv6: !1,
        fmt: "uris",
        out: null
    };

    function zt(e) {
        let t = e.settings?.public_host || location.host || "panel.example",
            s;
        return g.addrs === "host" ? s = [t] : g.addrs === "custom" ? s = g.customAddr.split(/[,\s]+/).filter(Boolean) : s = Oe(e.settings).slice(0, 10), g.ipv6 && (s = [...s, ...It]), {
            host: t,
            list: s.slice(0, 24)
        }
    }

    function Bt(e) {
        let t = (e.users || []).find(p => p.username === g.user) || (e.users || [])[0];
        if (!t) return null;
        let {
            host: s,
            list: i
        } = zt(e), o = t.uuid, r = [];
        for (let p of i)
            for (let $ of g.ports) {
                let M = we.includes(Number($));
                for (let k of g.protos) {
                    let L = k === "vless" ? t.uuid : o,
                        S = k === "vless" ? `/${t.uuid}` : "/trojan",
                        C = new URLSearchParams({
                            encryption: "none",
                            security: M ? "tls" : "none",
                            type: "ws",
                            host: s,
                            sni: s,
                            alpn: "http/1.1",
                            path: S
                        });
                    M && g.fp && C.set("fp", g.fp), M && g.fragment && (C.set("fragment", "100-200"), C.set("fragmentPackets", "tlshello"));
                    let q = `${g.user||"omni"}-${p.replace(/[:.]/g,"-")}:${$}`;
                    r.push({
                        proto: k,
                        addr: p,
                        port: $,
                        tls: M,
                        uri: `${k}://${L}@${p}:${$}?${C.toString()}#${encodeURIComponent(q)}`,
                        remark: q
                    })
                }
            }
        let c = r.map(p => p.uri),
            f = r.map((p, $) => ({
                type: p.proto,
                tag: `${p.proto}-${$}`,
                server: p.addr,
                server_port: Number(p.port),
                uuid: p.proto === "vless" ? t.uuid : o,
                tls: {
                    enabled: p.tls,
                    server_name: s,
                    utls: p.tls && g.fp ? {
                        enabled: !0,
                        fingerprint: g.fp
                    } : void 0
                },
                transport: {
                    type: "ws",
                    path: p.proto === "vless" ? `/${t.uuid}` : "/trojan",
                    headers: {
                        Host: s
                    },
                    max_early_data: 2048,
                    early_data_header_name: "Sec-WebSocket-Protocol"
                }
            })),
            u = {
                log: {
                    level: "warn",
                    timestamp: !0
                },
                inbounds: [{
                    type: "tun",
                    tag: "tun-in",
                    inet4_address: "172.19.0.1/30",
                    auto_route: !0,
                    strict_route: !0,
                    stack: "system"
                }],
                outbounds: [{
                    type: "selector",
                    tag: "select",
                    outbounds: ["auto", ...f.map(p => p.tag)]
                }, {
                    type: "urltest",
                    tag: "auto",
                    outbounds: f.map(p => p.tag),
                    url: "https://cp.cloudflare.com",
                    interval: "3m"
                }, {
                    type: "direct",
                    tag: "direct"
                }, ...f],
                route: {
                    rules: [{
                        ip_is_private: !0,
                        outbound: "direct"
                    }, {
                        domain_suffix: [".ir"],
                        outbound: "direct"
                    }],
                    final: "select",
                    auto_detect_interface: !0
                }
            },
            m = ["mixed-port: 7890", "allow-lan: false", "mode: rule", "log-level: warning", "proxies:", ...f.flatMap((p, $) => [`  - name: "${p.tag}"`, `    type: ${p.type}`, `    server: "${p.server}"`, `    port: ${p.server_port}`, p.type === "vless" ? `    uuid: "${p.uuid}"` : `    password: "${p.uuid}"`, `    tls: ${p.tls.enabled}`, `    servername: "${s}"`, `    client-fingerprint: "${g.fp||"chrome"}"`, "    network: ws", "    ws-opts:", `      path: "${p.transport.path}"`, "      max-early-data: 2048", "      early-data-header-name: Sec-WebSocket-Protocol", "      headers:", `        Host: "${s}"`]), "proxy-groups:", '  - name: "SELECT"', "    type: select", "    proxies:", ...f.map(p => `      - "${p.tag}"`), "rules:", "  - DOMAIN-SUFFIX,ir,DIRECT", "  - GEOIP,IR,DIRECT", "  - MATCH,SELECT"].join(`
`);
        return {
            count: r.length,
            items: r,
            uris: c,
            base64: Nt(c.join(`
`)),
            singbox: JSON.stringify(u, null, 2),
            clash: m,
            json: JSON.stringify({
                vless: c.filter((p, $) => r[$].proto === "vless"),
                trojan: c.filter((p, $) => r[$].proto === "trojan"),
                singbox: JSON.parse(JSON.stringify(u))
            }, null, 2),
            subUrl: `https://${s}/s/${t.sub_token}`
        }
    }

    function ct() {
        let e = document.querySelector("#cfg-out");
        if (!e || !g.out) return;
        let t = g.out,
            s = g.fmt === "uris" ? t.uris.map(i => `<div class="cfg-uri"><code dir="ltr">${a(i.length>150?i.slice(0,150)+"\u2026":i)}</code><button class="btn btn-sm" data-action="omni-copy" data-text="${a(i)}">${d("copy")}</button></div>`).join("") : g.fmt === "qrcode" ? `<div class="cfg-qrgrid">${t.items.slice(0,8).map((i,o)=>`<figure>${de(i.uri,132)}<figcaption>${a(i.remark)}</figcaption></figure>`).join("")}</div>` : `<div class="codebox" style="max-height:340px;overflow:auto"><code dir="ltr">${a(g.fmt==="base64"?t.base64:g.fmt==="singbox"?t.singbox:g.fmt==="clash"?t.clash:t.json)}</code></div>`;
        e.innerHTML = `
    <div class="cfg-meta">
      <span class="badge ok">${v(t.count)} ${a(n("cfg.configs"))}</span>
      <span class="muted" style="font-size:12px">${a(n("cfg.user"))}: <b>${a(g.user)}</b></span>
      <div style="flex:1"></div>
      <button class="btn btn-sm" data-action="omni-copy" data-text="${a(g.fmt==="uris"?t.uris.join(`
`):g.fmt==="base64"?t.base64:g.fmt==="singbox"?t.singbox:g.fmt==="clash"?t.clash:t.json)}">${d("copy")} ${a(n("common.copy"))}</button>
      <button class="btn btn-sm" data-action="omni-dl" data-fmt="${g.fmt}">${d("download")} ${a(n("common.download"))}</button>
    </div>
    <div class="chips" style="margin:8px 0">
      ${[["uris","URI"],["qrcode","QR"],["base64","Base64"],["singbox","sing-box"],["clash","Clash"],["json","JSON"]].map(([i,o])=>`<button class="chip" data-action="omni-fmt" data-fmt="${i}" aria-pressed="${g.fmt===i}">${o}</button>`).join("")}
    </div>
    ${s}
    <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn-sm" data-action="omni-deep" data-kind="cat">${d("bolt")} ${a(n("cfg.toOmni"))}</button>
      <button class="btn btn-sm" data-action="omni-deep" data-kind="v2ray">${d("bolt")} v2rayNG</button>
      <button class="btn btn-sm" data-action="omni-deep" data-kind="hiddify">${d("bolt")} Hiddify</button>
      <button class="btn btn-sm" data-action="omni-copy" data-text="${a(t.subUrl)}">${d("link")} ${a(n("cfg.subLink"))}</button>
    </div>`
    }

    function je(e) {
        let t = e.users || [];
        !g.user && t.length && (g.user = t[0].username);
        let s = [...new Set([...g.ports])];
        return `
  <header class="view-head">
    <div>
      <h2>${d("qr")} ${a(n("cfg.title"))}</h2>
      <p class="muted">${a(n("cfg.desc"))}</p>
    </div>
    <div class="head-actions">
      <select id="cfg-user" data-action-change="omni-cfg-user" class="input" style="min-width:150px">
        ${t.map(i=>`<option value="${a(i.username)}" ${g.user===i.username?"selected":""}>${a(i.username)}</option>`).join("")}
      </select>
      <button class="btn btn-primary" data-action="omni-cfg-build">${d("bolt")} ${a(n("cfg.build"))}</button>
    </div>
  </header>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-head">${d("globe")}<h3>${a(n("cfg.addresses"))}</h3></div>
      <div class="chips">
        ${[["clean",n("cfg.fromClean")],["host",n("cfg.fromHost")],["custom",n("cfg.fromCustom")]].map(([i,o])=>`<button class="chip" data-action="omni-cfg-addr" data-v="${i}" aria-pressed="${g.addrs===i}">${a(o)}</button>`).join("")}
      </div>
      ${g.addrs==="custom"?`<div class="field" style="margin-top:8px"><input id="cfg-custom" dir="ltr" placeholder="1.2.3.4, example.com" value="${a(g.customAddr)}"></div>`:""}
      <label class="switch" style="margin-top:10px"><input type="checkbox" id="cfg-ipv6" ${g.ipv6?"checked":""}><span></span> ${a(n("cfg.ipv6"))}</label>
      <p class="hint muted" style="font-size:11.5px">${v(Oe(e.settings).length)} ${a(n("cfg.cleanAvailable"))} \xB7 ${a(n("cfg.proxyips"))}: <code dir="ltr">${a(Dt.join(" \xB7 "))}</code></p>
    </div>
    <div class="card">
      <div class="card-head">${d("key")}<h3>${a(n("cfg.protoPorts"))}</h3></div>
      <div class="chips">
        ${["vless","trojan"].map(i=>`<button class="chip" data-action="omni-cfg-proto" data-v="${i}" aria-pressed="${g.protos.includes(i)}">${i.toUpperCase()}</button>`).join("")}
      </div>
      <div class="chips" style="margin-top:8px">
        ${[...we,...Ht].map(i=>`<button class="chip" data-action="omni-cfg-port" data-v="${i}" aria-pressed="${s.includes(i)}">${Ot(i)}</button>`).join("")}
      </div>
      <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">
        <label class="field" style="flex:1;min-width:130px"><span class="muted" style="font-size:12px">${a(n("users.form.fingerprint"))}</span>
          <select id="cfg-fp">${["","chrome","safari","ios","android","edge","firefox","randomized"].map(i=>`<option value="${i}" ${g.fp===i?"selected":""}>${i||"\u2014"}</option>`).join("")}</select></label>
        <label class="switch" style="align-self:end"><input type="checkbox" id="cfg-frag" ${g.fragment?"checked":""}><span></span> ${a(n("cfg.fragment"))}</label>
      </div>
    </div>
  </div>
  <div class="card" id="cfg-out" style="margin-top:14px">
    <div class="muted" style="font-size:13px">${a(n("cfg.hint"))}</div>
  </div>`
    }

    function Vt(e, t) {
        let s = document.createElement("a");
        s.href = URL.createObjectURL(new Blob([t], {
            type: "text/plain;charset=utf-8"
        })), s.download = e, s.click(), setTimeout(() => URL.revokeObjectURL(s.href), 4e3)
    }

    function Gt(e) {
        if (g.out = Bt(e), !g.out) return y(n("cfg.noUser"), "err");
        ct(), y(`${v(g.out.count)} ${n("cfg.configs")}`, "ok")
    }
    var O = {
        running: !1,
        results: []
    };

    function it(e) {
        return e < 0 ? "var(--danger)" : e < 150 ? "var(--ok)" : e < 400 ? "var(--warn)" : "var(--danger)"
    }

    function se(e) {
        let t = document.querySelector("#scan-status");
        t && (t.textContent = e)
    }

    function xe(e) {
        let t = document.querySelector("#scan-out");
        if (!t) return;
        let s = O.results.filter(r => r.ms !== null).length,
            i = document.querySelector("#scan-bar");
        i && (i.style.width = `${e?Math.round(s/e*100):0}%`);
        let o = r => r.ms === null ? 9e9 + 1 : r.ms < 0 ? 9e9 : r.ms;
        t.innerHTML = [...O.results].sort((r, c) => o(r) - o(c)).map(r => `
    <div class="scan-row">
      <code>${a(r.ip)}</code>
      <span class="scan-bar"><i style="width:${r.ms===null?0:r.ms<0?100:Math.min(100,Math.max(4,r.ms/10))}%;background:${r.ms===null?"var(--border)":it(r.ms)}"></i></span>
      <b style="color:${r.ms===null?"var(--text-faint)":it(r.ms)}">${r.ms===null?"\u2026":r.ms<0?a(n("scanner.timeout")):r.ms+" ms"}</b>
      ${r.healthy?`<span class="badge ok">${a(n("scanner.healthy"))}</span>`:""}
    </div>`).join("")
    }
    async function Zt(e, t) {
        let s = performance.now(),
            i = new AbortController,
            o = setTimeout(() => i.abort(), t);
        try {
            return await fetch(`https://${e}/`, {
                mode: "no-cors",
                cache: "no-store",
                signal: i.signal
            }), Math.round(performance.now() - s)
        } catch {
            let r = Math.round(performance.now() - s);
            return r >= t - 40 ? -1 : r
        } finally {
            clearTimeout(o)
        }
    }

    function dt(e) {
        let t = document.querySelector("#scan-ranges"),
            s = t ? t.value.split(/[\s,]+/).filter(Boolean) : rt.slice(0, 4),
            i = new Set,
            o = [...Oe(e.settings)];
        for (let r of o) i.add(r);
        for (let r of s)
            for (let c of Rt(r, 6)) i.has(c) || (i.add(c), o.push(c));
        return o.slice(0, 48)
    }
    async function Wt(e) {
        if (O.running) return;
        let t = dt(e.settings());
        if (!t.length) return;
        O.running = !0, O.results = t.map(c => ({
            ip: c,
            ms: null
        })), xe(t.length), se(n("scanner.testing"));
        let s = 0,
            i = async () => {
                for (; O.running;) {
                    let c = s++;
                    if (c >= t.length) break;
                    O.results[c].ms = await Zt(t[c], 1800), xe(t.length)
                }
            };
        await Promise.all(Array.from({
            length: Math.min(6, t.length)
        }, i)), O.running = !1, xe(t.length);
        let o = O.results.filter(c => c.ms >= 0).length;
        se(`${n("scanner.done")} \u2014 ${o}/${t.length} ${n("scanner.reachable")}`);
        let r = document.querySelector("#scan-apply");
        r && (r.disabled = o === 0)
    }
    async function Jt(e) {
        let t = dt(e.settings());
        if (t.length) {
            O.running = !1, se(n("scanner.ranking"));
            try {
                let s = await b.rankIps(t, e.settings().public_host || ""),
                    i = new Set(s.ips || []);
                O.results = t.map(r => ({
                    ip: r,
                    ms: i.has(r) ? 0 : -1,
                    healthy: i.has(r)
                })), xe(t.length), se(`${n("scanner.edgeOk")} ${i.size}/${t.length}`);
                let o = document.querySelector("#scan-apply");
                o && (o.disabled = i.size === 0)
            } catch {
                se(n("scanner.rankFail"))
            }
        }
    }
    async function Kt(e) {
        let t = O.results.filter(s => s.ms >= 0).sort((s, i) => s.ms - i.ms).slice(0, 8).map(s => s.ip);
        if (!t.length) return y(n("scanner.none"));
        await b.saveSettings({
            clean_ips: t
        }), e.setSettings({
            ...e.settings(),
            clean_ips: JSON.stringify(t)
        }), y(n("scanner.saved"))
    }

    function Fe(e) {
        return `
  <header class="view-head">
    <div>
      <h2>${d("search")} ${a(n("scanner.title"))}</h2>
      <p class="muted">${a(n("scanner.desc"))}</p>
    </div>
    <div class="head-actions">
      <button class="btn" data-action="omni-rank">${d("db")} ${a(n("scanner.rank"))}</button>
      <button class="btn btn-primary" data-action="omni-scan">${d("play")} ${a(n("scanner.start"))}</button>
    </div>
  </header>
  <div class="card">
    <div class="scan-progress"><i id="scan-bar" style="width:0%"></i></div>
    <div class="muted" id="scan-status" style="font-size:12.5px;margin-top:8px">${a(n("scanner.hint"))}</div>
    <div class="field" style="margin-top:10px">
      <label>${a(n("scanner.ranges"))}</label>
      <textarea id="scan-ranges" rows="2" dir="ltr">${a(rt.slice(0,4).join(`
`))}</textarea>
      <span class="hint muted" style="font-size:11px">${a(n("scanner.rangesHint"))}</span>
    </div>
  </div>
  <div class="card" id="scan-out">
    <div class="muted" style="font-size:13px">${a(n("scanner.empty"))}</div>
  </div>
  <div style="display:flex;gap:8px;margin-top:4px">
    <button class="btn btn-primary" id="scan-apply" data-action="omni-apply" disabled>${d("check")} ${a(n("scanner.apply"))}</button>
  </div>`
    }

    function ze(e) {
        let t = e.settings?.dns_upstream || "";
        return `
  <header class="view-head">
    <div>
      <h2>${d("globe")} ${a(n("dns.title"))}</h2>
      <p class="muted">${a(n("dns.desc"))}</p>
    </div>
  </header>
  <div class="dns-grid">
    ${Ut.map(s=>`
      <div class="dns-card">
        <b>${a(s.name)}</b>
        <code>${a(s.url)}</code>
        <code class="muted" style="font-size:10.5px">DoT: ${a(s.dot||"\u2014")}</code>
        <span class="dns-tags">
          ${s.ir?`<span class="badge ir">${a(n("dns.ir"))}</span>`:""}
          ${t===s.url?`<span class="badge ok">${a(n("dns.active"))}</span>`:""}
          <span class="dns-test" id="dnst-${a(s.name.replace(/\W+/g,""))}"></span>
        </span>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="btn btn-sm" data-action="omni-dns" data-url="${a(s.url)}">${a(n("dns.pick"))}</button>
          <button class="btn btn-sm" data-action="omni-dns-test" data-url="${a(s.url)}" data-key="${a(s.name.replace(/\W+/g,""))}">${d("play")} ${a(n("dns.test"))}</button>
        </div>
      </div>`).join("")}
  </div>
  <p class="muted" style="font-size:12.5px">${a(n("dns.note"))}</p>`
    }
    async function Qt(e) {
        let t = performance.now(),
            s = new AbortController,
            i = setTimeout(() => s.abort(), 4e3);
        try {
            let r = await (await fetch(`${e}?name=example.com&type=A`, {
                headers: {
                    accept: "application/dns-json"
                },
                cache: "no-store",
                signal: s.signal
            })).json();
            return {
                ms: Math.round(performance.now() - t),
                ok: Array.isArray(r.Answer) && r.Answer.length > 0
            }
        } catch {
            return {
                ms: Math.round(performance.now() - t),
                ok: !1,
                cors: !0
            }
        } finally {
            clearTimeout(i)
        }
    }

    function ut(e) {
        document.addEventListener("click", async t => {
            let s = t.target.closest('[data-action^="omni-"]');
            if (!s) return;
            let i = s.dataset.action;
            try {
                if (i === "omni-scan") Wt(e).catch(() => se(n("scanner.rankFail")));
                else if (i === "omni-rank") Jt(e);
                else if (i === "omni-apply") Kt(e).catch(() => y(n("scanner.rankFail")));
                else if (i === "omni-dns") await b.saveSettings({
                    dns_upstream: s.dataset.url
                }), e.setSettings({
                    ...e.settings(),
                    dns_upstream: s.dataset.url
                }), y(n("dns.saved")), e.rerender();
                else if (i === "omni-dns-test") {
                    let o = document.querySelector(`#dnst-${CSS.escape(s.dataset.key)}`);
                    o && (o.innerHTML = '<span class="badge">\u2026</span>');
                    let r = await Qt(s.dataset.url);
                    o && (o.innerHTML = r.ok ? `<span class="badge ok">${r.ms} ms</span>` : `<span class="badge warn" title="CORS">${r.cors?"\u2717":r.ms+" ms"}</span>`)
                } else if (i === "omni-cfg-build") Gt(e.S());
                else if (i === "omni-fmt") g.fmt = s.dataset.fmt, ct();
                else if (i === "omni-cfg-addr") g.addrs = s.dataset.v, e.rerenderView("configs");
                else if (i === "omni-cfg-proto") {
                    let o = s.dataset.v;
                    g.protos = g.protos.includes(o) ? g.protos.filter(r => r !== o) : [...g.protos, o], e.rerenderView("configs")
                } else if (i === "omni-cfg-port") {
                    let o = Number(s.dataset.v);
                    g.ports = g.ports.includes(o) ? g.ports.filter(r => r !== o) : [...g.ports, o], e.rerenderView("configs")
                } else if (i === "omni-copy") {
                    let o = await navigator.clipboard.writeText(s.dataset.text || "").then(() => !0, () => !1);
                    y(o ? n("users.drawer.copied") : "\u2717", o ? "ok" : "err", 1500)
                } else if (i === "omni-dl") {
                    let o = g.out;
                    if (!o) return;
                    let r = {
                            uris: ["omni-configs.txt", o.uris.join(`
`)],
                            qrcode: ["omni-configs.txt", o.uris.join(`
`)],
                            base64: ["omni-sub.txt", o.base64],
                            singbox: ["sing-box.json", o.singbox],
                            clash: ["clash.yaml", o.clash],
                            json: ["omni-configs.json", o.json]
                        },
                        [c, f] = r[s.dataset.fmt] || r.uris;
                    Vt(c, f)
                } else if (i === "omni-deep") {
                    let o = g.out;
                    if (!o) return;
                    let r = {
                        cat: `catclient://add-sub?url=${encodeURIComponent(o.subUrl)}&name=OMNI`,
                        v2ray: `v2rayng://install-sub?url=${encodeURIComponent(o.subUrl)}&remark=OMNI`,
                        hiddify: `hiddify://import-sub/${encodeURIComponent(o.subUrl)}`
                    };
                    location.href = r[s.dataset.kind] || r.cat
                }
            } catch (o) {
                y(String(o && o.message || o), "err")
            }
        }), document.addEventListener("change", t => {
            let s = t.target;
            s.id === "cfg-user" ? g.user = s.value : s.id === "cfg-ipv6" ? g.ipv6 = s.checked : s.id === "cfg-frag" ? g.fragment = s.checked : s.id === "cfg-fp" ? g.fp = s.value : s.id === "cfg-custom" && (g.customAddr = s.value)
        })
    }
    var Yt = matchMedia("(prefers-reduced-motion: reduce)"),
        Xt = matchMedia("(pointer: fine)"),
        Se = () => Yt.matches,
        me = 0,
        Me = null;

    function ea(e) {
        if (!Se()) {
            me = Me ? me : 0, clearTimeout(Me), Me = setTimeout(() => {
                me = 0, Me = null
            }, 260);
            for (let t of e) t.dataset.fx || (t.dataset.fx = "1", t.style.animationDelay = `${Math.min(me,10)*45}ms`, t.classList.add("fx-in"), me++, t.addEventListener("animationend", () => {
                t.style.animationDelay = ""
            }, {
                once: !0
            }))
        }
    }
    var pt = ".card, .toolbar, .bulkbar, tbody tr, .auth-card, .status-card, .tabs",
        ta = new MutationObserver(e => {
            let t = [];
            for (let s of e)
                for (let i of s.addedNodes) i instanceof Element && (i.matches(pt) ? t.push(i) : t.push(...i.querySelectorAll(pt)));
            t.length && ea(t)
        });

    function aa(e) {
        if (!Xt.matches || Se() || e.dataset.tilt) return;
        e.dataset.tilt = "1";
        let t = 0;
        e.addEventListener("pointermove", s => {
            t || (t = requestAnimationFrame(() => {
                t = 0;
                let i = e.getBoundingClientRect(),
                    o = (s.clientX - i.left) / i.width - .5,
                    r = (s.clientY - i.top) / i.height - .5;
                e.style.transform = `translateY(-3px) perspective(900px) rotateX(${(-r*4).toFixed(2)}deg) rotateY(${(o*5).toFixed(2)}deg)`
            }))
        }), e.addEventListener("pointerleave", () => {
            e.style.transform = ""
        })
    }

    function sa(e) {
        let t = e.target.closest?.(".btn, .nav-item, .seg button, .tabs button");
        if (!t || Se()) return;
        let s = t.getBoundingClientRect(),
            i = Math.max(s.width, s.height),
            o = document.createElement("span");
        o.className = "ripple", o.style.width = o.style.height = `${i}px`, o.style.left = `${e.clientX-s.left-i/2}px`, o.style.top = `${e.clientY-s.top-i/2}px`, t.append(o), setTimeout(() => o.remove(), 650)
    }

    function na(e) {
        if (Se() || e.dataset.counted) return;
        let t = e.textContent.trim();
        if (!t.match(/^[\d.,٬]+$/)) return;
        e.dataset.counted = "1";
        let i = Number(t.replaceAll(/[.,٬]/g, ""));
        if (!Number.isFinite(i) || i === 0) return;
        let o = t.includes(",") || t.includes("\u066C"),
            r = performance.now(),
            c = 700,
            f = m => o ? m.toLocaleString("en-US") : String(m),
            u = m => {
                let p = Math.min(1, (m - r) / c),
                    $ = 1 - (1 - p) ** 3;
                e.textContent = f(Math.round(i * $)), p < 1 ? requestAnimationFrame(u) : e.textContent = t
            };
        requestAnimationFrame(u)
    }

    function mt(e = document.body) {
        ta.observe(e, {
            childList: !0,
            subtree: !0
        }), document.addEventListener("pointerdown", sa, {
            passive: !0
        });
        let t = () => {
            document.querySelectorAll(".card").forEach(aa), document.querySelectorAll(".kpi-value").forEach(na)
        };
        t(), new MutationObserver(() => requestAnimationFrame(t)).observe(e, {
            childList: !0,
            subtree: !0
        })
    }
    var Be = new TextEncoder,
        ia = new TextDecoder;

    function oa(e) {
        let t = String(e).replaceAll("-", ""),
            s = new Uint8Array(16);
        for (let i = 0; i < 16; i++) s[i] = parseInt(t.slice(i * 2, i * 2 + 2), 16);
        return s
    }

    function ra({
        uuid: e,
        port: t,
        address: s
    }) {
        let i = Be.encode(s),
            o = [new Uint8Array([0]), oa(e), new Uint8Array([0]), new Uint8Array([1]), new Uint8Array([t >> 8 & 255, t & 255]), new Uint8Array([2]), new Uint8Array([i.length]), i],
            r = o.reduce((u, m) => u + m.byteLength, 0),
            c = new Uint8Array(r),
            f = 0;
        for (let u of o) c.set(u, f), f += u.byteLength;
        return c
    }

    function ft({
        host: e,
        uuid: t,
        target: s = "httpbin.org",
        port: i = 80,
        timeoutMs: o = 9e3
    }) {
        return new Promise(r => {
            let f = `${location.protocol==="https:"?"wss":"ws"}://${e||location.host}/${t}`,
                u = null,
                m = 0,
                p = !1,
                $ = "",
                M = !1,
                k = S => {
                    if (!p) {
                        p = !0, clearTimeout(L);
                        try {
                            u?.close()
                        } catch {}
                        r(S)
                    }
                },
                L = setTimeout(() => {
                    k(m ? {
                        ok: !1,
                        stage: "nodata"
                    } : {
                        ok: !1,
                        stage: "noopen"
                    })
                }, o);
            try {
                u = new WebSocket(f)
            } catch {
                return k({
                    ok: !1,
                    stage: "noopen"
                })
            }
            u.binaryType = "arraybuffer", u.onopen = () => {
                m = performance.now();
                let S = Be.encode(`GET /get HTTP/1.1\r
Host: ${s}\r
Connection: close\r
\r
`),
                    C = ra({
                        uuid: t,
                        port: i,
                        address: s
                    }),
                    q = new Uint8Array(C.byteLength + S.byteLength);
                q.set(C, 0), q.set(S, C.byteLength), u.send(q)
            }, u.onmessage = S => {
                let C = S.data instanceof ArrayBuffer ? new Uint8Array(S.data) : Be.encode(String(S.data)),
                    q = C;
                M || (M = !0, q = C.slice(1)), $ += ia.decode(q, {
                    stream: !0
                }), /HTTP\/1\.[01] \d{3}/.test($) && k({
                    ok: !0,
                    ms: Math.round(performance.now() - m),
                    stage: "ok"
                })
            }, u.onclose = S => {
                p || k(m ? {
                    ok: !1,
                    stage: "nodata",
                    detail: `close ${S.code}`
                } : {
                    ok: !1,
                    stage: "refused",
                    detail: `close ${S.code}`
                })
            }, u.onerror = () => {
                p || k(m ? {
                    ok: !1,
                    stage: "nodata"
                } : {
                    ok: !1,
                    stage: "refused"
                })
            }
        })
    }
    var h = (e, t = document) => t.querySelector(e),
        Y = (e, t = document) => [...t.querySelectorAll(e)],
        l = {
            me: null,
            installed: !0,
            authMode: "login",
            authError: "",
            signupAvailable: !1,
            signupResult: null,
            signupError: "",
            view: location.hash.slice(2) || "dashboard",
            overview: null,
            settings: {},
            fragments: {
                presets: [],
                fingerprints: []
            },
            users: [],
            total: 0,
            page: 1,
            size: 25,
            pages: 1,
            query: "",
            status: "all",
            sort: "created_at",
            dir: "desc",
            loading: !1,
            selection: new Set,
            logs: [],
            sessions: [],
            drawer: null,
            cfgFormat: "singbox",
            theme: localStorage.getItem("kaveh.theme") || "omni",
            sidebarOpen: !1
        };
    async function la() {
        try {
            let e = await b.whoami();
            l.me = e.username ? {
                username: e.username,
                role: e.role
            } : null, l.installed = e.installed !== !1, l.panelName = e.panelName || "Kaveh", l.signupAvailable = !!e.signup
        } catch (e) {
            l.me = null, l.installed = !(e instanceof B && e.code === "not_installed"), l.authError = e instanceof B ? e.message : "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 \u0633\u0631\u0648\u0631 \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u0634\u062F"
        }
        l.installed || (l.authMode = "setup"), H(), da(), ga(), window.addEventListener("hashchange", () => {
            l.view = location.hash.slice(2) || "dashboard", X()
        })
    }

    function ca() {
        P.set(localStorage.getItem("kaveh.lang") || "fa"), document.documentElement.dataset.theme = l.theme
    }

    function da() {
        "serviceWorker" in navigator && location.protocol.startsWith("http") && navigator.serviceWorker.register("/sw.js").catch(() => {}), window.addEventListener("online", () => gt(!0)), window.addEventListener("offline", () => gt(!1))
    }

    function gt(e) {
        let t = h("#conn-dot");
        t && (t.style.background = e ? "var(--ok)" : "var(--danger)")
    }
    async function H() {
        let e = h("#root");
        if (e.setAttribute("aria-busy", "false"), !l.me) {
            if (l.authMode === "signup") return e.innerHTML = at({
                result: l.signupResult,
                error: l.signupError
            });
            e.innerHTML = tt({
                mode: l.authMode,
                error: l.authError,
                signup: l.signupAvailable
            });
            return
        }
        await pa(), e.innerHTML = ua(), X()
    }
    var vt = [{
        id: "dashboard",
        icon: "dash",
        label: () => n("nav.dashboard")
    }, {
        id: "users",
        icon: "users",
        label: () => n("nav.users")
    }, {
        id: "configs",
        icon: "qr",
        label: () => n("nav.configs")
    }, {
        id: "scanner",
        icon: "search",
        label: () => n("nav.scanner")
    }, {
        id: "dns",
        icon: "globe",
        label: () => n("nav.dns")
    }, {
        id: "diag",
        icon: "activity",
        label: () => n("nav.diag")
    }, {
        id: "settings",
        icon: "gear",
        label: () => n("nav.settings")
    }, {
        id: "sessions",
        icon: "key",
        label: () => n("nav.sessions")
    }];

    function ua() {
        return `<div class="app">
    <aside class="sidebar ${l.sidebarOpen?"open":""}" id="sidebar">
      <div class="brand">
        <img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIiB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcm9sZT0iaW1nIiBhcmlhLWxhYmVsPSJLYXZlaCI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImtnIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyMmQzZWUiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjODE4Y2Y4Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGZpbHRlciBpZD0iZ2xvdyIgeD0iLTMwJSIgeT0iLTMwJSIgd2lkdGg9IjE2MCUiIGhlaWdodD0iMTYwJSI+CiAgICAgIDxmZURyb3BTaGFkb3cgZHg9IjAiIGR5PSIwIiBzdGREZXZpYXRpb249IjE4IiBmbG9vZC1jb2xvcj0iIzIyZDNlZSIgZmxvb2Qtb3BhY2l0eT0iMC41NSIvPgogICAgPC9maWx0ZXI+CiAgPC9kZWZzPgogIDxyZWN0IHdpZHRoPSI1MTIiIGhlaWdodD0iNTEyIiByeD0iMTIwIiBmaWxsPSIjMDYwNzBhIi8+CiAgPHJlY3QgeD0iNDAiIHk9IjQwIiB3aWR0aD0iNDMyIiBoZWlnaHQ9IjQzMiIgcng9IjEwNCIgZmlsbD0iIzBiMGQxMyIgc3Ryb2tlPSJ1cmwoI2tnKSIgc3Ryb2tlLXdpZHRoPSI2IiBvcGFjaXR5PSIwLjk1Ii8+CiAgPCEtLSBEZXJhZnNoLWUgS8SBdsSrxIFuOiB0aGUgYmxhY2tzbWl0aCdzIGFwcm9uIHJhaXNlZCBhcyBhIHN0YW5kYXJkIC0tPgogIDxnIGZpbHRlcj0idXJsKCNnbG93KSI+CiAgICA8cGF0aCBkPSJNMTgwIDExOCBMMzMyIDExOCBMMzU2IDMwMCBRMjU2IDM0MCAxNTYgMzAwIFoiIGZpbGw9InVybCgja2cpIiBmaWxsLW9wYWNpdHk9IjAuMTYiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KICAgIDxwYXRoIGQ9Ik0yNTYgMTE4IEwyNTYgNDAwIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICAgIDxjaXJjbGUgY3g9IjI1NiIgY3k9IjIxMiIgcj0iMzQiIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNrZykiIHN0cm9rZS13aWR0aD0iMTIiLz4KICAgIDxwYXRoIGQ9Ik0yMTQgMzcyIEwyOTggMzcyIiBzdHJva2U9InVybCgja2cpIiBzdHJva2Utd2lkdGg9IjE0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz4KICA8L2c+Cjwvc3ZnPgo=" alt="" width="34" height="34">
        <div><div class="brand-name">${a(l.panelName||n("app.name"))}</div>
        <div class="brand-sub">${a(n("app.tagline"))}</div></div>
      </div>
      ${vt.map(e=>`<button class="nav-item" data-action="nav" data-view="${e.id}" ${l.view===e.id?'aria-current="page"':""}>
          ${d(e.icon)} ${a(e.label())}</button>`).join("")}
      <div class="nav-sep"></div>
      <div class="nav-label">\u0638\u0627\u0647\u0631</div>
      <div class="theme-row" role="group" aria-label="Theme">
        ${ot.map(e=>`<button class="theme-dot" data-action="set-theme" data-theme="${e.id}" title="${a(e.label)}" aria-pressed="${l.theme===e.id}" aria-label="${a(e.label)}"><i style="background:linear-gradient(135deg, ${e.a} 50%, ${e.b} 50%)"></i></button>`).join("")}
      </div>
      <button class="nav-item" data-action="toggle-lang">${d("globe")} ${P.lang==="fa"?"English":"\u0641\u0627\u0631\u0633\u06CC"}</button>
      <div class="nav-sep"></div>
      <button class="nav-item" data-action="palette">${d("search")} ${a(n("common.search"))} <kbd style="margin-inline-start:auto">\u2318K</kbd></button>
      <div class="spacer" style="flex:1"></div>
      <button class="nav-item" data-action="logout" style="color:var(--danger)">${d("logout")} ${a(n("nav.logout"))}</button>
      <div class="muted" style="font-size:10.5px;padding:8px 10px 0;text-align:center">
        <span id="conn-dot" style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--ok);margin-inline-end:5px"></span>
        kaveh v0.1.0
      </div>
    </aside>
    <main class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon" data-action="toggle-sidebar" id="burger" style="display:none">${d("menu")}</button>
        <h1 id="view-title">${a(ht(l.view))}</h1>
        <div class="spacer"></div>
        <button class="btn btn-ghost btn-icon" data-action="refresh" title="${a(n("common.refresh"))}">${d("refresh")}</button>
      </header>
      <div class="content" id="view"></div>
    </main>
  </div>`
    }

    function ht(e) {
        return {
            dashboard: n("nav.dashboard"),
            users: n("nav.users"),
            settings: n("nav.settings"),
            diag: n("nav.diag"),
            sessions: n("nav.sessions"),
            scanner: n("nav.scanner"),
            dns: n("nav.dns"),
            configs: n("nav.configs")
        } [e] || n("app.name")
    }
    async function X() {
        let e = h("#view");
        if (!e) return H();
        if (h("#view-title") && (h("#view-title").textContent = ht(l.view)), Y(".nav-item[data-view]").forEach(t => {
                t.dataset.view === l.view ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")
            }), window.matchMedia("(max-width: 900px)").matches) {
            let t = h("#burger");
            t && (t.style.display = "")
        }
        switch (l.view) {
            case "users":
                e.innerHTML = Ie(l), await U();
                break;
            case "settings":
                e.innerHTML = qe(l.settings, l.fragments.presets, l.fragments.fingerprints), await ne(!0);
                break;
            case "diag":
                e.innerHTML = Ue(l.logs), await yt();
                break;
            case "sessions":
                e.innerHTML = Ne(l.sessions), await $t();
                break;
            case "scanner":
                e.innerHTML = Fe(l), await ne(), l.view === "scanner" && (e.innerHTML = Fe(l));
                break;
            case "configs":
                e.innerHTML = je(l), await ne(), await U(), l.view === "configs" && (e.innerHTML = je(l));
                break;
            case "dns":
                e.innerHTML = ze(l), await ne(), l.view === "dns" && (e.innerHTML = ze(l));
                break;
            default:
                l.view = "dashboard", e.innerHTML = ke(l.settings, null) + pe(null), await ne(), await Ge()
        }
    }
    async function Ge() {
        try {
            l.overview = await b.overview(7);
            let e = h("#view");
            e && l.view === "dashboard" && (e.innerHTML = ke(l.settings, l.overview) + pe(l.overview))
        } catch (e) {
            A(e)
        }
    }
    async function U() {
        l.loading = !0, ge();
        try {
            let e = await b.users({
                q: l.query,
                status: l.status,
                sort: l.sort,
                dir: l.dir,
                page: l.page,
                size: l.size
            });
            l.users = e.users, l.total = e.total, l.pages = e.pages || 1, l.page = e.page
        } catch (e) {
            A(e), l.users = []
        } finally {
            l.loading = !1, ge()
        }
    }

    function ge() {
        let e = h("#view");
        e && l.view === "users" && (e.innerHTML = Ie(l));
        let t = h("#user-search");
        t && document.activeElement !== t && (t.value = l.query)
    }
    async function pa() {
        if (!l.fragments.presets.length) try {
            l.fragments = await b.fragments()
        } catch {
            l.fragments = {
                presets: [{
                    id: "none",
                    label: "\u2014"
                }, {
                    id: "mci",
                    label: "MCI"
                }, {
                    id: "irancell",
                    label: "Irancell"
                }, {
                    id: "tci",
                    label: "TCI"
                }],
                fingerprints: ["chrome", "safari", "ios", "android"]
            }
        }
    }
    async function ne(e) {
        try {
            if (e || !Object.keys(l.settings).length) {
                let t = await b.settings();
                l.settings = t.settings || {};
                let s = h("#view");
                s && l.view === "settings" ? s.innerHTML = qe(l.settings, l.fragments.presets, l.fragments.fingerprints) : s && l.view === "dashboard" && (s.innerHTML = ke(l.settings, l.overview) + (l.overview ? pe(l.overview) : pe(null)))
            }
        } catch (t) {
            A(t)
        }
    }
    async function yt() {
        try {
            let e = await b.logs(60);
            l.logs = e.entries || [];
            let t = h("#view");
            t && l.view === "diag" && (t.innerHTML = Ue(l.logs))
        } catch {}
    }
    async function $t() {
        try {
            let e = await b.sessions();
            l.sessions = e.sessions || [];
            let t = h("#view");
            t && l.view === "sessions" && (t.innerHTML = Ne(l.sessions))
        } catch (e) {
            A(e)
        }
    }

    function A(e) {
        if (e instanceof B && e.status === 401) {
            l.me = null, l.authError = n("login.title"), H();
            return
        }
        y(e?.message || String(e), "err")
    }
    async function xt(e) {
        Ye({
            title: e,
            body: '<div class="skeleton" style="height:220px"></div>',
            footer: ""
        });
        try {
            let t = await b.user(e),
                s = [];
            try {
                s = (await b.userUsage(e, 14)).series || []
            } catch {}
            l.drawer = {
                user: t.user,
                configs: t.configs,
                usage: s
            }, l.cfgFormat = "singbox";
            let i = h(".drawer");
            i && (i.querySelector("h2").textContent = t.user.username, h(".modal-body", i).innerHTML = De(t.user, t.configs, s))
        } catch (t) {
            J(), A(t)
        }
    }

    function Ve(e = {}) {
        let t = !!e.username;
        Le({
            title: t ? `${n("common.edit")}: ${e.username}` : n("users.create"),
            body: st(e, l.fragments.presets, l.fragments.fingerprints),
            footer: `<button class="btn" data-action="close-modal">${a(n("common.cancel"))}</button>
             <button class="btn btn-primary" form="user-form" type="submit">${d(t?"check":"plus")} ${a(n(t?"common.save":"common.create"))}</button>`
        })
    }

    function wt(e) {
        let t = new FormData(e),
            s = {};
        for (let [i, o] of t.entries()) s[i] = o;
        for (let i of Y('input[type="checkbox"]', e))["ips", "proxies", "block_list"].includes(i.name) || (s[i.name] = i.checked);
        for (let i of Y("textarea", e)) s[i.name] = i.value.split(`
`).map(o => o.trim()).filter(Boolean);
        for (let i of Y('input[type="number"]', e)) s[i.name] = Number(i.value);
        return s
    }
    async function ma(e) {
        let t = wt(e),
            s = e.dataset.edit,
            i = h('button[type="submit"][form="user-form"]');
        i && (i.disabled = !0, i.innerHTML = '<div class="skeleton" style="width:60px;height:14px"></div>');
        try {
            let o = s ? await b.updateUser(s, t) : await b.createUser(t);
            W(), y(s ? "\u0630\u062E\u06CC\u0631\u0647 \u0634\u062F" : `\u06A9\u0627\u0631\u0628\u0631 \xAB${o.user.username}\xBB \u0633\u0627\u062E\u062A\u0647 \u0634\u062F`, "ok"), l.view === "users" ? await U() : l.view === "dashboard" && await Ge(), h(".drawer") && l.drawer?.user.username === o.user.username && (l.drawer = {
                ...l.drawer,
                user: o.user,
                configs: o.configs
            }, h(".drawer .modal-body").innerHTML = De(o.user, o.configs, l.drawer.usage))
        } catch (o) {
            y(o?.message || String(o), "err", 5e3), i && (i.disabled = !1, i.innerHTML = `${d("check")} ${a(n("common.save"))}`)
        }
    }

    function kt() {
        let e = [...vt.map(m => ({
                label: m.label(),
                icon: m.icon,
                run: () => fe(m.id)
            })), {
                label: n("users.create"),
                icon: "plus",
                run: () => Ve({})
            }, {
                label: l.theme === "dark" ? "\u062D\u0627\u0644\u062A \u0631\u0648\u0634\u0646" : "Dark mode",
                icon: l.theme === "dark" ? "sun" : "moon",
                run: Mt
            }, {
                label: P.lang === "fa" ? "English" : "\u0641\u0627\u0631\u0633\u06CC",
                icon: "globe",
                run: St
            }, {
                label: n("common.refresh"),
                icon: "refresh",
                run: () => X()
            }, {
                label: n("settings.export"),
                icon: "download",
                run: Ee
            }, {
                label: n("nav.logout"),
                icon: "logout",
                run: Te
            }, ...(l.users || []).slice(0, 60).map(m => ({
                label: `\u{1F464} ${m.username}`,
                icon: "users",
                run: () => xt(m.username)
            }))],
            t = document.createElement("div");
        t.className = "overlay", t.innerHTML = `<div class="palette" role="dialog" aria-modal="true">
      <input type="search" placeholder="${a(n("common.cmdk"))}" aria-label="command">
      <div class="palette-list"></div>
    </div>`, document.body.append(t);
        let s = h("input", t),
            i = h(".palette-list", t),
            o = e,
            r = 0,
            c = () => {
                i.innerHTML = o.slice(0, 40).map((m, p) => `<div class="palette-item" data-i="${p}" aria-selected="${p===r}">${d(m.icon)} ${a(m.label)}</div>`).join("") || '<div class="empty" style="padding:22px">\u2014</div>'
            },
            f = () => {
                let m = s.value.trim().toLowerCase();
                o = m ? e.filter(p => p.label.toLowerCase().includes(m)) : e, r = 0, c()
            },
            u = m => {
                let p = o[m];
                t.remove(), p?.run()
            };
        s.addEventListener("input", f), s.addEventListener("keydown", m => {
            m.key === "ArrowDown" ? (r = Math.min(r + 1, o.length - 1), c(), m.preventDefault()) : m.key === "ArrowUp" ? (r = Math.max(r - 1, 0), c(), m.preventDefault()) : m.key === "Enter" ? u(r) : m.key === "Escape" && t.remove()
        }), i.addEventListener("click", m => {
            let p = m.target.closest("[data-i]");
            p && u(Number(p.dataset.i))
        }), t.addEventListener("mousedown", m => {
            m.target === t && t.remove()
        }), c(), s.focus()
    }

    function fe(e) {
        l.view = e, location.hash = `#/${e}`, l.sidebarOpen = !1, h("#sidebar")?.classList.remove("open"), X()
    }

    function Mt() {
        l.theme = l.theme === "dark" ? "light" : "dark", localStorage.setItem("kaveh.theme", l.theme), document.documentElement.dataset.theme = l.theme, H()
    }

    function St() {
        P.set(P.lang === "fa" ? "en" : "fa"), H()
    }
    async function Te() {
        try {
            await b.logout()
        } catch {}
        l.me = null, l.authMode = "login", l.authError = "", H()
    }
    async function Tt(e, t) {
        let s = [...l.selection];
        if (s.length && !(e === "delete" && !await Q(n("users.confirmBulkDelete", {
                n: s.length
            }), {
                danger: !0
            }))) try {
            let i = await b.bulk(s, e, t);
            y(`${e}: ${i.affected} \u06A9\u0627\u0631\u0628\u0631`, "ok"), l.selection.clear(), await U()
        } catch (i) {
            A(i)
        }
    }
    async function fa() {
        let e = prompt(n("users.bulkExtend"), "30");
        e && await Tt("extend", Number(e))
    }

    function ga() {
        document.addEventListener("click", ba), document.addEventListener("submit", va), document.addEventListener("change", wa), document.addEventListener("input", Ma), document.addEventListener("keydown", Sa)
    }
    async function ba(e) {
        let t = e.target.closest("[data-action]");
        if (!t) return;
        let s = t.dataset.action,
            i = t.dataset.user;
        switch (s) {
            case "nav":
                return e.preventDefault(), fe(t.dataset.view);
            case "toggle-theme":
                return Mt();
            case "set-theme":
                return l.theme = t.dataset.theme || "omni", localStorage.setItem("kaveh.theme", l.theme), document.documentElement.dataset.theme = l.theme, H();
            case "toggle-lang":
                return St();
            case "toggle-sidebar":
                return l.sidebarOpen = !l.sidebarOpen, h("#sidebar")?.classList.toggle("open", l.sidebarOpen);
            case "palette":
                return kt();
            case "logout":
                return Te();
            case "refresh":
                return X();
            case "close-modal":
                return W();
            case "close-drawer":
                return J();
            case "goto-recover":
                return l.authMode = "recover", H();
            case "goto-login":
                return l.authMode = "login", l.signupResult = null, H();
            case "goto-signup":
                return l.authMode = "signup", H();
            case "do-signup":
                return ha();
            case "new-user":
                return Ve({});
            case "edit-user": {
                e.preventDefault();
                let o = (await b.user(i)).user;
                return Ve(o)
            }
            case "open-user":
                return e.preventDefault(), xt(i);
            case "delete-user": {
                if (e.preventDefault(), !await Q(n("users.confirmDelete", {
                        name: i
                    }), {
                        danger: !0,
                        okLabel: n("common.delete")
                    })) return;
                try {
                    await b.deleteUser(i), y("\u062D\u0630\u0641 \u0634\u062F", "ok"), J(), await (l.view === "users" ? U() : Ge())
                } catch (r) {
                    A(r)
                }
                return
            }
            case "reset-user": {
                try {
                    await b.resetUser(i, {
                        traffic: !0,
                        requests: !0
                    }), y("\u062D\u062C\u0645 \u0631\u06CC\u0633\u062A \u0634\u062F", "ok"), J(), await U()
                } catch (o) {
                    A(o)
                }
                return
            }
            case "live-test": {
                let o = t,
                    r = o.closest(".livetest"),
                    c = r?.querySelector("[data-lt-ms]"),
                    f = r?.querySelector("[data-lt-msg]");
                o.disabled = !0, c && (c.hidden = !1, c.className = "ms", c.textContent = "\u2026"), f && (f.textContent = n("live.running"));
                let u = await ft({
                    host: t.dataset.host || location.host,
                    uuid: t.dataset.uuid
                });
                o.disabled = !1, c && (c.className = `ms ${u.ok?"ok":"bad"}`, c.textContent = u.ok ? `${u.ms} ms` : "\u2715"), f && (f.textContent = n(`live.${u.stage}`)), y(n(`live.${u.stage}`), u.ok ? "ok" : "err");
                return
            }
            case "quick-toggle": {
                try {
                    await b.updateUser(i, {
                        is_active: t.dataset.active === "0"
                    }), await U()
                } catch (o) {
                    A(o)
                }
                return
            }
            case "select-user":
                return;
            case "select-all":
                return;
            case "clear-selection":
                return l.selection.clear(), ge();
            case "bulk":
                return Tt(t.dataset.op);
            case "bulk-extend":
                return fa();
            case "page":
                return l.page = Number(t.dataset.page), U();
            case "filter":
                return l.status = t.dataset.status, l.page = 1, X();
            case "sort": {
                let o = t.dataset.key;
                return l.sort === o ? l.dir = l.dir === "asc" ? "desc" : "asc" : (l.sort = o, l.dir = "desc"), U()
            }
            case "refresh-users":
                return U();
            case "copy": {
                let o = await ae(t.dataset.copy || "");
                return y(o ? n("users.drawer.copied") : "\u06A9\u067E\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F", o ? "ok" : "err", 1600)
            }
            case "copy-text": {
                let o = await ae(t.dataset.text || "");
                return y(o ? n("users.drawer.copied") : "\u06A9\u067E\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F", o ? "ok" : "err", 1600)
            }
            case "copy-sub": {
                let o = `${location.origin}${le(t.dataset.token)}`,
                    r = await ae(o);
                return y(r ? "\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u06A9\u067E\u06CC \u0634\u062F" : "\u06A9\u067E\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F", r ? "ok" : "err", 1800)
            }
            case "copy-all-uris": {
                let o = l.drawer?.configs?.uris || [],
                    r = await ae(o.join(`
`));
                return y(r ? `${o.length} \u06A9\u0627\u0646\u0641\u06CC\u06AF \u06A9\u067E\u06CC \u0634\u062F` : "\u06A9\u067E\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F", r ? "ok" : "err")
            }
            case "copy-cfg": {
                let o = await ae(h("#cfg-out")?.textContent || "");
                return y(o ? n("users.drawer.copied") : "\u06A9\u067E\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F", o ? "ok" : "err", 1600)
            }
            case "download-cfg": {
                let o = l.drawer?.configs || {},
                    r = l.cfgFormat,
                    c = r === "singbox" ? JSON.stringify(o.singbox, null, 2) : r === "clash" ? o.clash : o.base64,
                    f = r === "singbox" ? "json" : r === "clash" ? "yaml" : "txt",
                    u = new Blob([c], {
                        type: "text/plain;charset=utf-8"
                    }),
                    m = document.createElement("a");
                m.href = URL.createObjectURL(u), m.download = `${l.drawer.user.username}.${f}`, m.click(), URL.revokeObjectURL(m.href);
                return
            }
            case "cfg-format": {
                l.cfgFormat = t.dataset.format, Y("[data-action='cfg-format']").forEach(r => r.setAttribute("aria-pressed", String(r === t)));
                let o = l.drawer?.configs || {};
                h("#cfg-out").textContent = l.cfgFormat === "singbox" ? JSON.stringify(o.singbox, null, 2) : l.cfgFormat === "clash" ? o.clash : o.base64;
                return
            }
            case "drawer-tab": {
                Y("[data-action='drawer-tab']").forEach(o => o.setAttribute("aria-selected", String(o === t))), Y("[data-tab-panel]").forEach(o => o.classList.toggle("hide", o.dataset.tabPanel !== t.dataset.tab));
                return
            }
            case "rotate-token": {
                if (!await Q("\u0644\u06CC\u0646\u06A9 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0641\u0639\u0644\u06CC \u0628\u0627\u0637\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u06A9\u0627\u0631\u0628\u0631 \u0628\u0627\u06CC\u062F \u0644\u06CC\u0646\u06A9 \u062C\u062F\u06CC\u062F \u0631\u0627 \u0628\u06AF\u06CC\u0631\u062F. \u0627\u062F\u0627\u0645\u0647\u061F", {
                        danger: !0
                    })) return;
                try {
                    let r = await b.rotateToken(l.drawer.user.username);
                    l.drawer.user.sub_token = r.sub_token, h("#sub-link").textContent = `${location.origin}${le(r.sub_token)}`, y("\u062A\u0648\u06A9\u0646 \u062C\u062F\u06CC\u062F \u0633\u0627\u062E\u062A\u0647 \u0634\u062F", "ok")
                } catch (r) {
                    A(r)
                }
                return
            }
            case "rotate-uuid": {
                if (!await Q("UUID \u0639\u0648\u0636 \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0647\u0645\u0647\u200C\u06CC \u06A9\u0627\u0646\u0641\u06CC\u06AF\u200C\u0647\u0627\u06CC \u0642\u0628\u0644\u06CC \u0627\u0632 \u06A9\u0627\u0631 \u0645\u06CC\u200C\u0627\u0641\u062A\u0646\u062F. \u0627\u062F\u0627\u0645\u0647\u061F", {
                        danger: !0
                    })) return;
                try {
                    await b.rotateUuid(l.drawer.user.username), y("UUID \u0639\u0648\u0636 \u0634\u062F", "ok"), J(), await U()
                } catch (r) {
                    A(r)
                }
                return
            }
            case "reload-settings":
                return ne(!0);
            case "change-password":
                return xa();
            case "export-backup":
                return Ee();
            case "revoke-all": {
                if (!await Q("\u0647\u0645\u0647\u200C\u06CC \u0646\u0634\u0633\u062A\u200C\u0647\u0627 \u0628\u0627\u0637\u0644 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u0628\u0627\u06CC\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F.", {
                        danger: !0
                    })) return;
                try {
                    await b.revokeAll(), await Te()
                } catch (r) {
                    A(r)
                }
                return
            }
            case "revoke-session": {
                try {
                    await b.revoke(t.dataset.id), await $t()
                } catch (o) {
                    A(o)
                }
                return
            }
            case "probe":
                return Ta();
            case "rank":
                return _a();
            case "ping":
                return Ea();
            case "reload-logs":
                return yt()
        }
    }

    function va(e) {
        let t = e.target;
        if (e.preventDefault(), t.id === "auth-form") return ya(t);
        if (t.id === "user-form") return ma(t);
        if (t.id === "settings-form") return $a(t)
    }
    async function ha() {
        l.signupError = "";
        try {
            l.signupResult = await b.signup(), H()
        } catch (e) {
            l.signupError = e?.message || String(e), H()
        }
    }
    async function ya(e) {
        let t = e.dataset.mode,
            s = new FormData(e),
            i = h('button[type="submit"]', e);
        i.disabled = !0, l.authError = "";
        try {
            if (t === "setup") await b.setup(s.get("password"), s.get("username") || "admin");
            else if (t === "recover") {
                let r = await fetch("/api/recover", {
                        method: "POST",
                        headers: {
                            "content-type": "application/json"
                        },
                        body: JSON.stringify({
                            code: s.get("code"),
                            password: s.get("password")
                        })
                    }),
                    c = await r.json();
                if (!r.ok || c.ok === !1) throw new B(r.status, c.code, c.error);
                return y("\u0631\u0645\u0632 \u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC \u0634\u062F. \u062F\u0648\u0628\u0627\u0631\u0647 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F.", "ok"), l.authMode = "login", H()
            } else await b.login(s.get("password"), s.get("username"));
            let o = await b.whoami();
            l.me = {
                username: o.username,
                role: o.role
            }, l.panelName = o.panelName || "Kaveh", y(`\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F\u060C ${l.me.username} \u{1F44B}`, "ok"), location.hash = "#/dashboard", l.view = "dashboard", H()
        } catch (o) {
            l.authError = o?.message || String(o), H()
        } finally {
            i.disabled = !1
        }
    }
    async function $a(e) {
        let t = wt(e),
            s = {};
        for (let i of ["panel_name", "public_host", "port", "fragment_preset", "fingerprint", "remark_prefix", "default_quota_gb", "default_expiry_days", "rotate_minutes", "signup_max_per_ip"]) t[i] !== void 0 && t[i] !== "" && (s[i] = String(t[i]));
        for (let i of ["maintenance", "auto_rotate", "mux_enabled", "block_nsfw", "block_ads", "public_signup"]) s[i] = t[i] ? "1" : "0";
        for (let i of ["clean_ips", "ip_pool"]) Array.isArray(t[i]) && (s[i] = t[i]);
        try {
            let i = await b.saveSettings(s);
            l.settings = i.settings, y(n("settings.saved"), "ok"), l.panelName = l.settings.panel_name || l.panelName, H()
        } catch (i) {
            A(i)
        }
    }
    async function xa() {
        let e = h("#settings-form"),
            t = e?.pw_current?.value,
            s = e?.pw_next?.value;
        if (!t || !s) return y("\u0647\u0631 \u062F\u0648 \u0641\u06CC\u0644\u062F \u0631\u0645\u0632 \u0631\u0627 \u067E\u0631 \u06A9\u0646\u06CC\u062F", "warn");
        try {
            await b.changePassword(t, s), y("\u0631\u0645\u0632 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F. \u062F\u0648\u0628\u0627\u0631\u0647 \u0648\u0627\u0631\u062F \u0634\u0648\u06CC\u062F.", "ok"), await Te()
        } catch (i) {
            A(i)
        }
    }

    function wa(e) {
        let t = e.target,
            s = t.dataset.action;
        if (s === "select-user") {
            t.checked ? l.selection.add(t.dataset.user) : l.selection.delete(t.dataset.user), t.closest("tr")?.classList.toggle("selected", t.checked), ge();
            return
        }
        if (s === "select-all") return l.selection = t.checked ? new Set(l.users.map(i => i.username)) : new Set, ge();
        if (s === "import-backup") return ka(t.files?.[0])
    }
    async function ka(e) {
        if (e) try {
            let t = JSON.parse(await e.text());
            if (!await Q(`${t.users?.length||0} \u06A9\u0627\u0631\u0628\u0631 \u0627\u0632 \u0641\u0627\u06CC\u0644 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0634\u0648\u062F\u061F \u062D\u0627\u0644\u062A \xAB\u062C\u0627\u06CC\u06AF\u0632\u06CC\u0646\u06CC\xBB \u06A9\u0627\u0631\u0628\u0631\u0627\u0646 \u0641\u0639\u0644\u06CC \u0631\u0627 \u067E\u0627\u06A9 \u0645\u06CC\u200C\u06A9\u0646\u062F.`, {
                    danger: !0
                })) return;
            let i = await b.post("/api/backup", {
                ...t,
                mode: "replace"
            });
            y(`${i.imported} \u06A9\u0627\u0631\u0628\u0631 \u0628\u0627\u0632\u06CC\u0627\u0628\u06CC \u0634\u062F`, "ok"), await U()
        } catch (t) {
            A(t)
        }
    }
    var bt;

    function Ma(e) {
        e.target.id === "user-search" && (clearTimeout(bt), bt = setTimeout(() => {
            l.query = e.target.value, l.page = 1, U()
        }, Number(e.target.dataset.debounce || 300)))
    }

    function Sa(e) {
        let t = /input|textarea|select/i.test(e.target.tagName);
        if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) return e.preventDefault(), l.me ? kt() : null;
        if (e.key === "Escape") {
            h(".overlay")?.remove(), J(), W();
            return
        }!t && l.me && (e.key === "/" && (e.preventDefault(), h("#user-search")?.focus()), e.key === "g" ? l._g = Date.now() : l._g && Date.now() - l._g < 1200 && (e.key === "d" && fe("dashboard"), e.key === "u" && fe("users"), e.key === "s" && fe("settings"), l._g = 0))
    }
    async function Ta() {
        let e = h("#probe-input").value.trim(),
            t = h("#probe-out");
        if (!e) return y("\u0622\u062F\u0631\u0633 \u067E\u0631\u0648\u06A9\u0633\u06CC \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F", "warn");
        t.innerHTML = '<div class="skeleton" style="height:34px"></div>';
        try {
            let s = await b.probeNode(e);
            t.innerHTML = s.ok ? `<div class="badge ok">${d("check")} \u0633\u0627\u0644\u0645 \xB7 ${v(s.latencyMs)} ms</div>` : `<div class="badge danger">${d("alert")} \u0642\u0637\u0639</div><div class="codebox" style="margin-top:8px">${a(s.error||"")}</div>`
        } catch (s) {
            t.innerHTML = `<div class="toast err">${a(s.message)}</div>`
        }
    }
    async function _a() {
        let e = h("#rank-input").value.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean),
            t = h("#rank-out");
        if (!e.length) return y("\u0622\u06CC\u200C\u067E\u06CC \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F", "warn");
        t.innerHTML = '<div class="skeleton" style="height:34px"></div>';
        try {
            let s = await b.rankIps(e, l.settings.public_host || location.hostname);
            t.innerHTML = `<div class="muted" style="font-size:12px;margin-bottom:8px">${v(s.healthy)} \u0627\u0632 ${v(s.total)} \u0633\u0627\u0644\u0645</div>
      <div class="codebox">${a(s.ips.join(`
`))}</div>
      <div style="margin-top:8px">${te(s.ips.join(`
`))}
      <button class="btn btn-sm" data-action="apply-ranked">${d("check")} \u0627\u0639\u0645\u0627\u0644 \u062F\u0631 \u0622\u06CC\u200C\u067E\u06CC \u062A\u0645\u06CC\u0632</button></div>`, window.__ranked = s.ips
        } catch (s) {
            t.innerHTML = `<div class="toast err">${a(s.message)}</div>`
        }
    }
    async function Ea() {
        let e = h("#ping-input").value.trim(),
            t = h("#ping-out");
        t.innerHTML = '<div class="skeleton" style="height:34px"></div>';
        try {
            let s = await b.ping(e);
            t.innerHTML = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <span class="badge ${s.avg==null?"danger":"ok"}">${s.avg==null?"unreachable":`${v(s.avg)} ms`}</span>
        ${s.colo?`<span class="badge info">${a(s.colo)}</span>`:""}
        <span class="muted" style="font-size:12px">loss ${a(s.loss)}</span></div>
      <div class="codebox" style="margin-top:8px;max-height:110px">${a(JSON.stringify(s.samples,null,2))}</div>`
        } catch (s) {
            t.innerHTML = `<div class="toast err">${a(s.message)}</div>`
        }
    }
    async function La() {
        let e = h("#maintenance-out");
        e.innerHTML = '<div class="skeleton" style="height:34px"></div>';
        try {
            let t = await b.maintenance();
            e.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="badge ok">${d("check")} ${v(t.ms)} ms</span>
        <span class="badge ${t.expired_handled?"info":""}">${a(n("diag.expired"))}: ${v(t.expired_handled)}</span>
        <span class="badge">${a(n("diag.ipsRotated"))}: ${v(t.ips_rotated)}</span>
      </div>
      <div class="codebox" style="margin-top:8px">${a(JSON.stringify(t,null,2))}</div>`, y(n("diag.maintenanceDone"), "ok")
        } catch (t) {
            e.innerHTML = `<div class="toast err">${a(t.message)}</div>`
        }
    }
    document.addEventListener("click", async e => {
        if (e.target.closest("[data-action='maintenance']")) return La();
        if (e.target.closest("[data-action='apply-ranked']")) try {
            let t = await b.saveSettings({
                clean_ips: window.__ranked || []
            });
            l.settings = t.settings, y("\u0622\u06CC\u200C\u067E\u06CC\u200C\u0647\u0627\u06CC \u062A\u0645\u06CC\u0632 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F", "ok")
        } catch (t) {
            A(t)
        }
    });
    ca();
    mt();
    ut({
        settings: () => l.settings,
        setSettings: e => {
            l.settings = e
        },
        rerender: () => H(),
        S: () => l,
        rerenderView: e => {
            l.view = e, X()
        }
    });
    la();
})();