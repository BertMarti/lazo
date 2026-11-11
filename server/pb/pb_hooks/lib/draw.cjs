"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/core/draw.ts
var draw_exports = {};
__export(draw_exports, {
  DrawImpossible: () => DrawImpossible,
  cryptoRand: () => cryptoRand,
  drawPairs: () => drawPairs
});
module.exports = __toCommonJS(draw_exports);
var DrawImpossible = class extends Error {
  constructor(reason, who) {
    super(reason);
    __publicField(this, "reason", reason);
    __publicField(this, "who", who);
    this.name = "DrawImpossible";
  }
};
var MAX_STEPS = 1e4;
function drawPairs(ids, exclusions, rand) {
  const people = [...new Set(ids)];
  if (people.length < 3) throw new DrawImpossible("Hacen falta al menos 3 personas.");
  const banned = /* @__PURE__ */ new Set();
  for (const [a, b] of exclusions) {
    banned.add(`${a}>${b}`);
    banned.add(`${b}>${a}`);
  }
  const allowed = (g, r) => g !== r && !banned.has(`${g}>${r}`);
  for (const g of people) {
    if (!people.some((r) => allowed(g, r)))
      throw new DrawImpossible("Con estas exclusiones, hay alguien que no puede regalar a nadie.", g);
  }
  const shuffle = (xs) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const givers = shuffle(people);
  const taken = /* @__PURE__ */ new Set();
  const out = /* @__PURE__ */ new Map();
  let steps = 0;
  const solve = (i) => {
    if (i === givers.length) return true;
    const g = givers[i];
    for (const r of shuffle(people)) {
      if (++steps > MAX_STEPS) return false;
      if (taken.has(r) || !allowed(g, r)) continue;
      taken.add(r);
      out.set(g, r);
      if (solve(i + 1)) return true;
      taken.delete(r);
      out.delete(g);
    }
    return false;
  };
  if (!solve(0)) throw new DrawImpossible("Con estas exclusiones no hay ning\xFAn reparto posible. Quita alguna.");
  return out;
}
var cryptoRand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
