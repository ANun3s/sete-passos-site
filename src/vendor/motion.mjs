//#region node_modules/.pnpm/motion-utils@14.1.1/node_modules/motion-utils/dist/es/array.mjs
function e(e, t) {
	e.indexOf(t) === -1 && e.push(t);
}
function t(e, t) {
	let n = e.indexOf(t);
	n > -1 && e.splice(n, 1);
}
//#endregion
//#region node_modules/.pnpm/motion-utils@14.1.1/node_modules/motion-utils/dist/es/clamp.mjs
var n = (e, t, n) => n > t ? t : n < e ? e : n;
//#endregion
//#region node_modules/.pnpm/motion-utils@14.1.1/node_modules/motion-utils/dist/es/format-error-message.mjs
function r(e, t) {
	return t ? `${e}. For more information and steps for solving, visit https://motion.dev/troubleshooting/${t}` : e;
}
//#endregion
//#region node_modules/.pnpm/motion-utils@14.1.1/node_modules/motion-utils/dist/es/errors.mjs
var i = () => {};
typeof process < "u" && process.env.NODE_ENV !== "production" && (i = (e, t, n) => {
	!e && typeof console < "u" && console.warn(r(t, n));
});
//#endregion
//#region node_modules/.pnpm/motion-utils@14.1.1/node_modules/motion-utils/dist/es/global-config.mjs
var a = {}, o = (e) => typeof e == "object" && !!e, s = /* @__NO_SIDE_EFFECTS__ */ (e) => e, c = class {
	constructor() {
		this.subscriptions = [];
	}
	add(t) {
		return e(this.subscriptions, t), () => this.remove(t);
	}
	remove(e) {
		t(this.subscriptions, e);
	}
	notify(e, t, n) {
		let r = this.subscriptions.length;
		if (r) {
			if (r === 1) this.subscriptions[0](e, t, n);
			else for (let i = 0; i < r; i++) {
				let r = this.subscriptions[i];
				r && r(e, t, n);
			}
		}
	}
	getSize() {
		return this.subscriptions.length;
	}
	clear() {
		this.subscriptions.length = 0;
	}
}, l = /* @__NO_SIDE_EFFECTS__ */ (e) => e * 1e3, u = /* @__NO_SIDE_EFFECTS__ */ (e) => e / 1e3, d = /* @__NO_SIDE_EFFECTS__ */ (e, t) => t ? 1e3 / t * e : 0, f = /* @__PURE__ */ new Set();
function p(e, t, n) {
	e || f.has(t) || (console.warn(r(t, n)), f.add(t));
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/frameloop/frame-data.mjs
var m = {
	delta: 0,
	timestamp: 0,
	isProcessing: !1
}, h;
function g() {
	h = void 0;
}
var _ = {
	now: () => (h === void 0 && _.set(m.isProcessing || a.useManualTiming ? m.timestamp : performance.now()), h),
	set: (e) => {
		h = e, queueMicrotask(g);
	}
}, v = {
	test: (e) => typeof e == "number",
	parse: parseFloat,
	transform: (e) => e
}, y = {
	...v,
	transform: (e) => n(0, 1, e)
}, b = {
	...v,
	default: 1
}, x = /* @__NO_SIDE_EFFECTS__ */ (e) => ({
	test: (t) => typeof t == "string" && t.endsWith(e) && t.split(" ").length === 1,
	parse: parseFloat,
	transform: (t) => `${t}${e}`
}), S = /*@__PURE__*/ x("deg"), C = /*@__PURE__*/ x("%"), w = /*@__PURE__*/ x("px"), T = {
	...C,
	parse: (e) => C.parse(e) / 100,
	transform: (e) => C.transform(e * 100)
}, E = [
	"setup",
	"read",
	"resolveKeyframes",
	"preUpdate",
	"update",
	"preRender",
	"render",
	"postRender"
];
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/frameloop/render-step.mjs
function ee(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set(), r = !1, i = !1, a = /* @__PURE__ */ new Set(), o = {
		delta: 0,
		timestamp: 0,
		isProcessing: !1
	};
	function s(t) {
		a.has(t) && (n.add(t), e()), t(o);
	}
	let c = {
		schedule: (e, i = !1, o = !1) => {
			let s = o && r ? t : n;
			return i && a.add(e), s.add(e), e;
		},
		cancel: (e) => {
			n.delete(e), a.delete(e);
		},
		process: (e) => {
			if (o = e, r) {
				i = !0;
				return;
			}
			r = !0;
			let a = t;
			t = n, n = a, t.forEach(s), t.clear(), r = !1, i && (i = !1, c.process(e));
		}
	};
	return c;
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/frameloop/batcher.mjs
var te = 40;
function ne(e, t, n = {
	delta: 0,
	timestamp: 0,
	isProcessing: !1
}) {
	let r = !1, i = !0, o = () => r = !0, s = E.reduce((e, t) => (e[t] = ee(o), e), {}), { setup: c, read: l, resolveKeyframes: u, preUpdate: d, update: f, preRender: p, render: m, postRender: h } = s, g = () => {
		let o = a.useManualTiming, s = o ? n.timestamp : performance.now();
		r = !1, o || (n.delta = i ? 1e3 / 60 : Math.max(Math.min(s - n.timestamp, te), 1)), n.timestamp = s, n.isProcessing = !0, c.process(n), l.process(n), u.process(n), d.process(n), f.process(n), p.process(n), m.process(n), h.process(n), n.isProcessing = !1, r && t && (i = !1, e(g));
	}, _ = () => {
		r = !0, i = !0, n.isProcessing || e(g);
	};
	return {
		schedule: E.reduce((e, t) => {
			let n = s[t];
			return e[t] = (e, t = !1, i = !1) => (r || _(), n.schedule(e, t, i)), e;
		}, {}),
		cancel: (e) => {
			for (let t = 0; t < E.length; t++) s[E[t]].cancel(e);
		},
		state: n,
		steps: s
	};
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/frameloop/frame.mjs
var { schedule: D, cancel: re, steps: ie } = /* @__PURE__ */ ne(typeof requestAnimationFrame < "u" ? requestAnimationFrame : s, !0, m), ae = (e, t, n = 10) => {
	let r = "", i = Math.max(Math.round(t / n), 2);
	for (let t = 0; t < i; t++) r += Math.round(e(t / (i - 1)) * 1e4) / 1e4 + ", ";
	return `linear(${r.substring(0, r.length - 2)})`;
}, O = 2e4;
function k(e, t = 50, n = O, r) {
	let i = 0, a = e.next(i);
	for (r?.push(a.value); !a.done && i < n;) i += t, a = e.next(i), r?.push(a.value);
	return i >= n ? Infinity : i;
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/animation/generators/utils/create-generator-easing.mjs
function oe(e, t = 100, n) {
	let { keyframes: r, velocity: i } = e, a = r && r[r.length - 1] - r[0], o = n({
		...e,
		velocity: i && a ? i * t / a : i,
		keyframes: [0, t]
	}), s = Math.min(k(o), O);
	return {
		type: "keyframes",
		ease: (e) => o.next(s * e).value / t,
		duration: /* @__PURE__ */ u(s)
	};
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/animation/generators/spring.mjs
var A = {
	stiffness: 100,
	damping: 10,
	mass: 1,
	duration: 800,
	bounce: .3,
	visualDuration: .3,
	restSpeed: {
		granular: .01,
		default: 2
	},
	restDelta: {
		granular: .005,
		default: .5
	},
	minDuration: .01,
	maxDuration: 10,
	minDamping: .05
}, se = (e) => e < 0 ? 1 / Math.max(1 + e, A.minDamping) : Math.max(1 - e, A.minDamping);
function ce(e, t) {
	if (!(e > 1)) return 1;
	let n = Math.sqrt(e * e - 1), r = e - n, i = e + n, a = 2 * n * Math.exp(-t) * (1 + t);
	return ue((e) => i * Math.exp(-r * e) - r * Math.exp(-i * e) - a, (e) => Math.exp(-i * e) - Math.exp(-r * e), t) / t;
}
function j(e, t) {
	return e * Math.sqrt(1 - t * t);
}
var le = 12;
function ue(e, t, n) {
	let r = n;
	for (let n = 1; n < le; n++) r -= e(r) / t(r);
	return r;
}
var M = .001;
function de({ duration: e = A.duration, bounce: t = A.bounce }) {
	let r, a;
	i(e <= /* @__PURE__ */ l(A.maxDuration), "Spring duration must be 10 seconds or less", "spring-duration-limit");
	let o = se(t);
	e = n(A.minDuration, A.maxDuration, /* @__PURE__ */ u(e)), o < 1 ? (r = (t) => {
		let n = t * o, r = n * e, i = j(t, o), a = Math.exp(-r);
		return M - n / i * a;
	}, a = (t) => {
		let n = t * o * e, i = o * o * t * t * e, a = Math.exp(-n), s = j(t * t, o);
		return (-r(t) + M > 0 ? -1 : 1) * -i * a / s;
	}) : (r = (t) => -.001 + Math.exp(-t * e) * (t * e + 1), a = (t) => Math.exp(-t * e) * (-t * (e * e)));
	let s = 5 / e, c = ue(r, a, s), d = c * ce(o, c * e), f = d * d;
	return {
		stiffness: f,
		damping: o * 2 * Math.sqrt(f),
		duration: /* @__PURE__ */ l(e)
	};
}
var N = (e, t) => (t ? e >= 0 : e > 0) && e < Infinity;
function P(e, t) {
	if (N(e, t)) return e;
	process.env.NODE_ENV !== "production" && i(e === void 0, "Spring stiffness and mass must be positive, damping 0 or greater", "spring-invalid-physics");
}
function fe(e) {
	let t = P(e.stiffness), n = P(e.damping, !0), r = P(e.mass), i = {
		...e,
		stiffness: t ?? A.stiffness,
		damping: n ?? A.damping,
		mass: r ?? A.mass,
		isResolvedFromDuration: !1,
		isTimeDefined: (t ?? n ?? r) === void 0 && (e.duration !== void 0 || e.bounce !== void 0)
	};
	if (i.isTimeDefined) {
		if (e.visualDuration) {
			let t = se(e.bounce || 0), n = 2 * Math.PI / (e.visualDuration * 1.2) * ce(t, 2 * Math.PI / 1.2);
			i.stiffness = n * n, i.damping = 2 * t * Math.sqrt(i.stiffness);
		} else Object.assign(i, de(i)), i.isResolvedFromDuration = !0;
		(!N(i.stiffness) || !N(i.damping, !0)) && (i.stiffness = A.stiffness, i.damping = A.damping);
	}
	return i;
}
function F(e = A.visualDuration, t = A.bounce) {
	let n = typeof e == "object" ? e : {
		visualDuration: e,
		keyframes: [0, 1],
		bounce: t
	}, r = n.keyframes[0], i = n.keyframes[n.keyframes.length - 1], a = {
		done: !1,
		value: r
	}, { stiffness: o, damping: s, mass: c, duration: d, isResolvedFromDuration: f, isTimeDefined: p } = fe({ ...n }), m = (e) => p ? 0 : -/* @__PURE__ */ u(e), h = s / (2 * Math.sqrt(o * c)), g = /* @__PURE__ */ u(Math.sqrt(o / c)), _ = h * g, v = {
		target: i,
		delta: i - r,
		velocity: m(n.velocity || 0) || 0,
		restSpeed: 0,
		restDelta: 0
	}, y = () => {
		let e = Math.abs(v.delta) < 5;
		v.restSpeed = n.restSpeed || (e ? A.restSpeed.granular : A.restSpeed.default), v.restDelta = n.restDelta || (e ? A.restDelta.granular : A.restDelta.default);
	};
	y();
	let b, x, S;
	if (h < 1) {
		let e = j(g, h), t = {
			A: 0,
			sinC: 0,
			cosC: 0,
			t: -1,
			env: 0,
			sin: 0,
			cos: 0
		};
		S = () => {
			t.A = (v.velocity + _ * v.delta) / e, t.sinC = _ * t.A + v.delta * e, t.cosC = _ * v.delta - t.A * e;
		};
		let n = (n) => {
			n !== t.t && (t.t = n, t.env = Math.exp(-_ * n), t.sin = Math.sin(e * n), t.cos = Math.cos(e * n));
		};
		b = (e) => (n(e), v.target - t.env * (t.A * t.sin + v.delta * t.cos)), x = (e) => (n(e), t.env * (t.sinC * t.sin + t.cosC * t.cos));
	} else if (h === 1) {
		b = (e) => v.target - Math.exp(-g * e) * (v.delta + (v.velocity + g * v.delta) * e);
		let e = { C: 0 };
		S = () => {
			e.C = v.velocity + g * v.delta;
		}, x = (t) => Math.exp(-g * t) * (g * e.C * t - v.velocity);
	} else {
		let e = g * Math.sqrt(h * h - 1), t = _ - e, n = _ + e, r = p ? Infinity : 300 / e, i = (e, t) => Math.exp(t > r ? -e * r - _ * (t - r) : -e * t), a = {
			S: 0,
			F: 0
		};
		S = () => {
			let t = (v.velocity + _ * v.delta) / e;
			a.S = (v.delta + t) / 2, a.F = (v.delta - t) / 2;
		}, b = (e) => v.target - a.S * i(t, e) - a.F * i(n, e), x = (e) => t * a.S * i(t, e) + n * a.F * i(n, e);
	}
	S();
	let C = f && d || null, w = {
		calculatedDuration: C,
		retarget: (e, t) => {
			v.target = e[e.length - 1], v.delta = v.target - e[0], v.velocity = m(t), n.restSpeed && n.restDelta || y(), w.calculatedDuration = C, a.done = !1, S();
		},
		velocity: (e) => /* @__PURE__ */ l(x(e)),
		next: (e) => {
			let t = b(e);
			if (f) a.done = e >= d;
			else {
				let n = /* @__PURE__ */ l(x(e));
				a.done = Math.abs(n) <= v.restSpeed && Math.abs(v.target - t) <= v.restDelta;
			}
			return a.value = a.done ? v.target : t, a;
		},
		toString: () => {
			let e = Math.min(k(w), O), t = ae((t) => w.next(e * t).value, e, 30);
			return e + "ms " + t;
		},
		toTransition: () => {}
	};
	return w;
}
F.applyToOptions = (e) => {
	let t = oe(e, 100, F);
	return e.ease = t.ease, e.duration = /* @__PURE__ */ l(t.duration), e.type = "keyframes", e;
};
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/animation/generators/utils/velocity.mjs
var pe = 5;
function me(e, t, n) {
	let r = Math.max(t - pe, 0);
	return /* @__PURE__ */ d(n - e(r), t - r);
}
function he(e, t, n = 0) {
	return t <= 0 ? n : e.velocity ? e.velocity(t) : me((t) => e.next(t).value, t, e.next(t).value);
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/animation/utils/resolve-start-time.mjs
var ge = 40, _e = (e, t) => t - e > ge && !a.useManualTiming ? t : e, ve = class {
	constructor() {
		this.isResolved = !1;
	}
	get finished() {
		return this._finished ||= this.isResolved ? Promise.resolve() : new Promise((e) => {
			this._resolve = e;
		}), this._finished;
	}
	updateFinished() {
		this._finished = this._resolve = void 0, this.isResolved = !1;
	}
	notifyFinished() {
		this.isResolved = !0, this._resolve?.();
	}
	then(e, t) {
		return this.finished.then(e, t);
	}
}, I = {
	...v,
	transform: Math.round
}, L = {
	rotate: S,
	pathRotation: S,
	rotateX: S,
	rotateY: S,
	rotateZ: S,
	scale: b,
	scaleX: b,
	scaleY: b,
	scaleZ: b,
	skew: S,
	skewX: S,
	skewY: S,
	distance: w,
	translateX: w,
	translateY: w,
	translateZ: w,
	x: w,
	y: w,
	z: w,
	perspective: w,
	transformPerspective: w,
	opacity: y,
	originX: T,
	originY: T,
	originZ: w
}, R = {
	borderWidth: w,
	borderTopWidth: w,
	borderRightWidth: w,
	borderBottomWidth: w,
	borderLeftWidth: w,
	borderRadius: w,
	borderTopLeftRadius: w,
	borderTopRightRadius: w,
	borderBottomRightRadius: w,
	borderBottomLeftRadius: w,
	width: w,
	maxWidth: w,
	height: w,
	maxHeight: w,
	top: w,
	right: w,
	bottom: w,
	left: w,
	inset: w,
	insetBlock: w,
	insetBlockStart: w,
	insetBlockEnd: w,
	insetInline: w,
	insetInlineStart: w,
	insetInlineEnd: w,
	padding: w,
	paddingTop: w,
	paddingRight: w,
	paddingBottom: w,
	paddingLeft: w,
	paddingBlock: w,
	paddingBlockStart: w,
	paddingBlockEnd: w,
	paddingInline: w,
	paddingInlineStart: w,
	paddingInlineEnd: w,
	margin: w,
	marginTop: w,
	marginRight: w,
	marginBottom: w,
	marginLeft: w,
	marginBlock: w,
	marginBlockStart: w,
	marginBlockEnd: w,
	marginInline: w,
	marginInlineStart: w,
	marginInlineEnd: w,
	fontSize: w,
	backgroundPositionX: w,
	backgroundPositionY: w,
	...L,
	zIndex: I,
	fillOpacity: y,
	strokeOpacity: y,
	numOctaves: I
}, z = (e) => e * 180 / Math.PI, B = (e) => V(z(Math.atan2(e[1], e[0]))), ye = {
	x: 4,
	y: 5,
	translateX: 4,
	translateY: 5,
	scaleX: 0,
	scaleY: 3,
	scale: (e) => (Math.abs(e[0]) + Math.abs(e[3])) / 2,
	rotate: B,
	rotateZ: B,
	skewX: (e) => z(Math.atan(e[1])),
	skewY: (e) => z(Math.atan(e[2])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[2])) / 2
}, V = (e) => (e %= 360, e < 0 && (e += 360), e), H = B, U = (e) => Math.sqrt(e[0] * e[0] + e[1] * e[1]), W = (e) => Math.sqrt(e[4] * e[4] + e[5] * e[5]), be = {
	x: 12,
	y: 13,
	z: 14,
	translateX: 12,
	translateY: 13,
	translateZ: 14,
	scaleX: U,
	scaleY: W,
	scale: (e) => (U(e) + W(e)) / 2,
	rotateX: (e) => V(z(Math.atan2(e[6], e[5]))),
	rotateY: (e) => V(z(Math.atan2(-e[2], e[0]))),
	rotateZ: H,
	rotate: H,
	skewX: (e) => z(Math.atan(e[4])),
	skewY: (e) => z(Math.atan(e[1])),
	skew: (e) => (Math.abs(e[1]) + Math.abs(e[4])) / 2
};
function G(e) {
	return +!!e.includes("scale");
}
function xe(e, t) {
	if (!e || e === "none") return G(t);
	let n = e.match(/^matrix3d\(([-\d.e\s,]+)\)$/u), r, i;
	if (n) r = be, i = n;
	else {
		let t = e.match(/^matrix\(([-\d.e\s,]+)\)$/u);
		r = ye, i = t;
	}
	if (!i) return G(t);
	let a = r[t], o = i[1].split(",").map(Ce);
	return typeof a == "function" ? a(o) : o[a];
}
var Se = (e, t) => {
	let { transform: n = "none" } = getComputedStyle(e);
	return xe(n, t);
};
function Ce(e) {
	return parseFloat(e.trim());
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/render/utils/keys-transform.mjs
var K = [
	"transformPerspective",
	"x",
	"y",
	"z",
	"translateX",
	"translateY",
	"translateZ",
	"scale",
	"scaleX",
	"scaleY",
	"rotate",
	"rotateX",
	"rotateY",
	"rotateZ",
	"skew",
	"skewX",
	"skewY"
], we = /* @__PURE__ */ new Set([...K, "pathRotation"]), q = (e) => e.startsWith("--"), J = (e, t) => t && typeof e == "number" ? t.transform(e) : e, Te = {
	x: "translateX",
	y: "translateY",
	z: "translateZ",
	transformPerspective: "perspective"
};
K.length;
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/animation/waapi/transforms/groups.mjs
var Ee = /* @__PURE__ */ new WeakMap(), De = 30, Oe = (e) => !isNaN(parseFloat(e)), ke = { current: void 0 }, Y = class {
	constructor(e, t = {}) {
		this.canTrackVelocity = null, this.events = {}, this.updateAndNotify = (e) => {
			let t = _.now();
			if (this.updatedAt !== t && this.setPrevFrameValue(), this.prev = this.current, this.setCurrent(e), this.current !== this.prev && (this.notifyChange(), this.dependents)) for (let e of this.dependents) e.dirty();
		}, this.hasAnimated = !1, this.setCurrent(e), this.owner = t.owner;
	}
	setCurrent(e) {
		this.current = e, this.updatedAt = _.now(), this.canTrackVelocity === null && e !== void 0 && (this.canTrackVelocity = Oe(this.current));
	}
	setPrevFrameValue(e = this.current) {
		this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt;
	}
	onChange(e) {
		return process.env.NODE_ENV !== "production" && p(!1, "value.onChange(callback) is deprecated. Switch to value.on(\"change\", callback)."), this.on("change", e);
	}
	on(e, t) {
		var n;
		return e === "change" ? this.onChangeSubscribe(t) : ((n = this.events)[e] || (n[e] = new c())).add(t);
	}
	onChangeSubscribe(e) {
		let { events: t } = this;
		return !t.change && !this.changeSubscriber ? this.changeSubscriber = e : (t.change || (t.change = new c(), t.change.add(this.changeSubscriber), this.changeSubscriber = void 0), t.change.add(e)), () => {
			this.changeSubscriber === e ? this.changeSubscriber = void 0 : t.change?.remove(e), this.stopIfUnobserved();
		};
	}
	stopIfUnobserved() {
		D.read(() => {
			!this.changeSubscriber && !this.events.change?.getSize() && this.stop();
		});
	}
	clearListeners() {
		this.changeSubscriber = void 0;
		for (let e in this.events) this.events[e].clear();
	}
	attach(e, t) {
		this.passiveEffect = e, this.stopPassiveEffect = t;
	}
	set(e) {
		this.passiveEffect ? this.passiveEffect(e, this.updateAndNotify) : this.updateAndNotify(e);
	}
	setWithVelocity(e, t, n) {
		this.set(t), this.prev = void 0, this.prevFrameValue = e, this.prevUpdatedAt = this.updatedAt - n;
	}
	jump(e, t = !0) {
		this.updateAndNotify(e), this.prev = e, this.prevUpdatedAt = this.prevFrameValue = void 0, t && this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
	dirty() {
		this.notifyChange();
	}
	notifyChange() {
		let { current: e, changeSubscriber: t } = this;
		t ? t(e) : this.events.change?.notify(e);
	}
	addDependent(e) {
		this.dependents ||= /* @__PURE__ */ new Set(), this.dependents.add(e);
	}
	removeDependent(e) {
		this.dependents && this.dependents.delete(e);
	}
	get() {
		ke.current && ke.current.push(this);
		let e = this.animation?.liveValue?.();
		return e === void 0 ? this.current : e;
	}
	getCurrent() {
		return this.current;
	}
	getPrevious() {
		return this.prev;
	}
	getVelocity() {
		let e = _.now();
		if (!this.canTrackVelocity || this.prevFrameValue === void 0 || e - this.updatedAt > De) return 0;
		let t = Math.min(this.updatedAt - this.prevUpdatedAt, De);
		return /* @__PURE__ */ d(parseFloat(this.current) - parseFloat(this.prevFrameValue), t);
	}
	start(e) {
		return this.stop(), new Promise((t) => {
			this.hasAnimated = !0;
			let n = !1, r;
			r = e(() => {
				n = !0, this.events.animationComplete?.notify(), this.animation === r && this.clearAnimation(), t();
			}), n || (this.animation = r), this.events.animationStart?.notify();
		});
	}
	stop() {
		this.animation && (this.animation.stop(), this.events.animationCancel && this.events.animationCancel.notify()), this.clearAnimation();
	}
	isAnimating() {
		return !!this.animation;
	}
	clearAnimation() {
		this.animation = void 0;
	}
	destroy() {
		this.dependents?.clear(), this.events.destroy?.notify(), this.clearListeners(), this.stop(), this.stopPassiveEffect && this.stopPassiveEffect();
	}
};
function Ae(e, t) {
	return new Y(e, t);
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/value/utils/is-motion-value.mjs
var je = (e) => !!(e && e.getVelocity);
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/utils/is-html-element.mjs
function Me(e) {
	return o(e) && "offsetHeight" in e && !("ownerSVGElement" in e);
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/utils/is-svg-element.mjs
function Ne(e) {
	return o(e) && "ownerSVGElement" in e;
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/utils/resolve-elements.mjs
function Pe(e, t, n) {
	if (e == null) return [];
	if (e instanceof EventTarget) return [e];
	if (typeof e == "string") {
		let r = document;
		t && (r = t.current);
		let i = n?.[e] ?? r.querySelectorAll(e);
		return i ? Array.from(i) : [];
	}
	return Array.from(e).filter((e) => e != null);
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/effects/utils/create-dom-effect.mjs
function Fe(e) {
	let t = (t, n) => {
		let r = Pe(t), i = [];
		for (let t of r) {
			let r = e(t, n);
			i.push(r);
		}
		return () => {
			for (let e of i) e();
		};
	}, { test: n, read: r, get: i, flush: a, state: o } = e;
	return Object.assign(t, {
		test: n,
		read: r,
		get: i,
		flush: a,
		state: o
	});
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/effects/MotionValueState.mjs
var Ie = class {
	constructor(e = D.render) {
		this.step = e, this.values = /* @__PURE__ */ new Map(), this.pending = [], this.numPending = 0, this.flush = () => {
			let { pending: e, numPending: t } = this;
			this.numPending = 0;
			for (let n = 0; n < t; n++) e[n]();
		};
	}
	set(e, t, n, r) {
		if (this.values.get(e)?.onRemove(), r) for (let e of this.values.values()) e.value === r && (n = e.render);
		let i = () => n && this.schedule(n);
		t.get() !== void 0 && i();
		let a = t.on("change", i), o = () => {
			a(), n && !r && this.cancel(n), this.values.get(e)?.onRemove === o && this.values.delete(e);
		};
		return this.values.set(e, {
			value: t,
			render: r ? void 0 : n,
			onRemove: o
		}), o;
	}
	get(e) {
		return this.values.get(e)?.value;
	}
	release() {
		let e = /* @__PURE__ */ new Map();
		return this.values.forEach((t, n) => {
			e.set(n, t.value), t.onRemove();
		}), this.transformKeys = this.transformValues = void 0, e;
	}
	schedule(e) {
		let { pending: t, numPending: n } = this;
		for (let r = 0; r < n; r++) if (t[r] === e) return;
		n || this.step(this.flush), t[this.numPending++] = e;
	}
	cancel(e) {
		let { pending: t } = this;
		for (let n = 0; n < this.numPending; n++) if (t[n] === e) {
			t[n] = t[--this.numPending];
			return;
		}
	}
};
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/effects/utils/create-effect.mjs
function Le(e, { step: t, ...n } = {}) {
	let r = /* @__PURE__ */ new WeakMap();
	return Object.assign((n, i) => {
		let a = r.get(n) ?? new Ie(t);
		r.set(n, a);
		let o = [];
		for (let t in i) {
			let r = i[t], s = e(n, a, t, r);
			o.push(s);
		}
		return () => {
			for (let e of o) e();
		};
	}, n, {
		get: (e, t) => r.get(e)?.get(t),
		flush: (e) => r.get(e)?.flush(),
		state: (e) => r.get(e)
	});
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/effects/style/transform.mjs
var X = {};
function Re(e) {
	let t = "", { transformKeys: n = [], transformValues: r = {} } = e;
	for (let e = 0; e < n.length; e++) {
		let i = n[e], a = r[i].getCurrent();
		a !== void 0 && (typeof a == "number" ? a : parseFloat(a)) !== +!!i.startsWith("scale") && (t += (t && " ") + (X[i] || (X[i] = (Te[i] || i) + "(")) + J(a, L[i]) + ")");
	}
	let i = e.get("pathRotation")?.get();
	return i && (t += (t && " ") + "rotate(" + J(i, L.pathRotation) + ")"), t || "none";
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/effects/style/index.mjs
var ze = /* @__PURE__ */ new Set([
	"originX",
	"originY",
	"originZ"
]), Z = (e, t) => J(e.get(t)?.get(), R[t]), Be = (e, t, n, r) => {
	let i, a;
	if (we.has(n)) {
		if (n !== "pathRotation") {
			let e = t.transformKeys ??= [];
			(t.transformValues ??= {})[n] = r, e.includes(n) || (e.push(n), e.sort((e, t) => K.indexOf(e) - K.indexOf(t)));
		}
		t.get("transform") || (!Me(e) && !t.get("transformBox") && Be(e, t, "transformBox", new Y("fill-box")), t.set("transform", new Y("none"), () => {
			Ee.get(e)?.check(), e.style.transform = Re(t);
		})), a = t.get("transform");
	} else ze.has(n) ? (t.get("transformOrigin") || t.set("transformOrigin", new Y(""), () => {
		let n = Z(t, "originX") ?? "50%", r = Z(t, "originY") ?? "50%", i = Z(t, "originZ") ?? 0;
		e.style.transformOrigin = `${n} ${r} ${i}`;
	}), a = t.get("transformOrigin")) : i = q(n) ? () => {
		e.style.setProperty(n, r.getCurrent());
	} : () => {
		e.style[n] = J(r.getCurrent(), R[n]);
	};
	return t.set(n, r, i, a);
}, Ve = /*@__PURE__*/ Fe(/* @__PURE__ */ Le(Be, {
	test: (e) => Me(e) || Ne(e),
	read: (e, t) => {
		if (we.has(t)) return Se(e, t);
		let n = getComputedStyle(e), r = q(t) ? n.getPropertyValue(t) : n[t];
		return typeof r == "string" && r.trim() || 0;
	}
})), Q = /* @__PURE__ */ new Set(), He = ({ timestamp: e }) => {
	Q.forEach((t) => t.tick(e));
}, Ue = class extends ve {
	constructor(e) {
		super(), this.state = "idle", this.startTime = 0, this.currentTime = 0, this.started = !1, this.hasNextTarget = !1, this.nextTarget = 0, this.stop = () => {
			this.state !== "idle" && (this.teardown(), this.options.onStop?.());
		}, this.options = e, this.factory = e.type, this.generator = this.factory(e);
		let { driver: t } = e;
		t && (this.driver = t((e) => this.tick(e))), this.startTime = this.now(), this.state = "running", this.driver ? this.driver.start() : (Q.size || D.update(He, !0), Q.add(this));
	}
	setTarget(e, t) {
		this.nextTarget = e, this.nextVelocity = t, this.hasNextTarget = !0;
	}
	retarget(e, t) {
		let { options: n, generator: r } = this;
		n.keyframes = e, n.velocity = t, this.startTime = this.now(), this.currentTime = 0, r.retarget ? r.retarget(e, t) : this.generator = this.factory(n);
	}
	tick(e) {
		let { options: t, hasNextTarget: n } = this, { delay: r = 0, onUpdate: i, onPlay: a } = t;
		this.started || (this.startTime = _e(this.startTime, e));
		let o = Math.round(e - this.startTime) - r, s = this.currentTime = Math.max(0, o), c = this.generator.next(s), l = o < 0 ? t.keyframes[0] : c.value;
		if (n) {
			this.hasNextTarget = !1;
			let { keyframes: e } = t;
			e[0] = l, e[1] = this.nextTarget, this.retarget(e, this.nextVelocity ?? this.getGeneratorVelocity());
		}
		(n || !this.started) && (this.started = !0, a?.()), this.state === "running" && (i?.(l), c.done && o >= 0 && !n && !this.hasNextTarget && this.state === "running" && (this.notifyFinished(), this.teardown(), this.state = "finished", t.onComplete?.()));
	}
	getGeneratorVelocity() {
		return he(this.generator, this.currentTime, this.options.velocity);
	}
	now() {
		return this.driver ? this.driver.now() : _.now();
	}
	teardown() {
		this.state = "idle", this.driver ? this.driver.stop() : (Q.delete(this), Q.size || re(He));
	}
}, We = (e) => typeof e == "number" ? e : parseFloat(e);
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/value/utils/follow.mjs
function Ge(e, t, n) {
	let r = e.get(), i = null, a, o = typeof r == "string" ? r.replace(/[\d.-]/g, "") : void 0, s = (e) => a(o ? e + o : e), c = () => e.events.animationStart?.notify(), l = () => {
		i &&= (i.stop(), null), e.animation = void 0;
	};
	if (e.attach((t, r) => {
		a = r;
		let o = We(t);
		if (i?.state === "running") {
			i.setTarget(o, n.velocity);
			return;
		}
		let u = We(e.get()), d = i ? i.getGeneratorVelocity() : e.getVelocity();
		if (l(), u === o) return;
		let f = i = new Ue({
			keyframes: [u, o],
			velocity: d,
			restDelta: .001,
			restSpeed: .01,
			...n,
			onUpdate: s,
			onPlay: c
		});
		e.animation = f, f.then(() => {
			i === f && (i = null, e.animation = void 0, e.events.animationComplete?.notify());
		});
	}, l), je(t)) {
		let r = n.skipInitialAnimation === !0, i = t.on("change", (t) => {
			r ? (r = !1, e.jump($(t, o), !1)) : e.set($(t, o));
		}), a = e.on("destroy", i);
		return () => {
			i(), a();
		};
	}
	return l;
}
function $(e, t) {
	return t ? e + t : e;
}
//#endregion
//#region node_modules/.pnpm/motion-dom@14.2.0/node_modules/motion-dom/dist/es/value/spring-value.mjs
function Ke(e, t) {
	let n = Ae(je(e) ? e.get() : e);
	return qe(n, e, t), n;
}
function qe(e, t, n) {
	return Ge(e, t, {
		...n,
		type: F
	});
}
//#endregion
export { Ke as springValue, Ve as styleEffect };
