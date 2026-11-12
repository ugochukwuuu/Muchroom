import type { Category, Variant } from './types';
import { money } from './types';

type PriceLimit = { amount: number; inclusive: boolean };
type PriceRange = { min?: PriceLimit; max?: PriceLimit };

export type Need = {
  category?: Category;
  price?: PriceRange;
  use?: string;
  portable?: boolean;
  ram?: number;
  brand?: string;
  bluetooth?: boolean;
};

const categoryTerms: [Category, RegExp][] = [
  ['Laptops', /\b(laptops?|notebooks?|macbooks?|thinkpads?|latitude|elitebook)\b/i],
  ['Projectors', /\bprojectors?\b/i],
  ['Audio', /\b(audio|speakers?|earbuds?|headphones?|soundbars?)\b/i],
  ['Accessories', /\b(accessor(?:y|ies)|mice|mouse|keyboards?|chargers?)\b/i],
];

const useTerms: [string, RegExp][] = [
  ['Coding', /\b(coding|programming|software development|developers?)\b/i],
  ['Design', /\b(design|photoshop|editing|illustration)\b/i],
  ['Gaming', /\b(gaming|games|steam)\b/i],
  ['Presentations', /\b(presentations?|slides|classroom|conference)\b/i],
  ['Study', /\b(study|school|students?|lectures?|university)\b/i],
  ['Entertainment', /\b(movies?|netflix|music|entertainment)\b/i],
  ['Office', /\b(office|spreadsheets?|documents?|meetings?)\b/i],
];

const currency = String.raw`(?:₦|\bngn)\s*`;
const number = String.raw`\d+(?:\.\d+)?`;
const scale = String.raw`\s*(?:million|thousand|[km])\b`;
const markedPrice = String.raw`(?:${currency}${number}(?:${scale})?|\b${number}${scale})`;
const priceAmount = String.raw`(?:${markedPrice}|\b\d{4,}(?:\.\d+)?)(?![\d.]|\s*(?:gb|tb|mb|kg)\b)`;
const priceRange = new RegExp(String.raw`(?:\bbetween\s+|\bfrom\s+)?(${priceAmount})\s*(?:\band\b|\bto\b|[-–—])\s*(${priceAmount})`);
const priceBound = new RegExp(String.raw`\b(at least|no less than|min(?:imum)?(?: of)?|above|over|more than|at most|no more than|up to|max(?:imum)?(?: of)?|under|below|less than|budget(?: of| is)?|make it)\s+(${priceAmount})`, 'g');

function parsePrice(raw: string) {
  const [value] = raw.match(/\d+(?:\.\d+)?/) ?? [];
  const unit = raw.match(/(?:million|thousand|[km])$/)?.[0];
  const multiplier = unit === 'm' || unit === 'million' ? 1_000_000 : unit ? 1_000 : 1;
  const amount = Number(value) * multiplier;
  return amount > 0 && amount <= Number.MAX_SAFE_INTEGER ? amount : undefined;
}

function interpretPrice(message: string, previous?: PriceRange): PriceRange | undefined {
  if (/\b(no budget limit|any price|no budget cap)\b/.test(message)) return undefined;
  const range = message.match(priceRange);
  if (range && (!/\band\b/.test(range[0]) || /\bbetween\b/.test(range[0]))) {
    const min = parsePrice(range[1]);
    const max = parsePrice(range[2]);
    if (min && max) return { min: { amount: min, inclusive: true }, max: { amount: max, inclusive: true } };
  }
  const limits: PriceRange = {};
  for (const [, operator, raw] of message.matchAll(priceBound)) {
    const amount = parsePrice(raw);
    if (!amount) continue;
    if (/^(at least|no less than|min)/.test(operator)) limits.min = { amount, inclusive: true };
    else if (['above', 'over', 'more than'].includes(operator)) limits.min = { amount, inclusive: false };
    else if (operator === 'make it' && previous?.min && !previous.max) limits.min = { ...previous.min, amount };
    else limits.max = { amount, inclusive: !['under', 'below', 'less than'].includes(operator) };
  }
  if (limits.min || limits.max) return limits;
  const raw = message.match(new RegExp(markedPrice))?.[0];
  const amount = raw && parsePrice(raw);
  return amount ? { max: { amount, inclusive: true } } : previous;
}

export function describePrice(price?: PriceRange) {
  if (!price) return [];
  const { min, max } = price;
  if (min?.inclusive && max?.inclusive) return [money(min.amount) + ' to ' + money(max.amount)];
  return [
    ...(min ? [(min.inclusive ? 'At least ' : 'Above ') + money(min.amount)] : []),
    ...(max ? [(max.inclusive ? 'Up to ' : 'Under ') + money(max.amount)] : []),
  ];
}

function matchesPrice(amount: number, price?: PriceRange) {
  const { min, max } = price ?? {};
  return (!min || amount > min.amount || (min.inclusive && amount === min.amount))
    && (!max || amount < max.amount || (max.inclusive && amount === max.amount));
}

export function interpret(message: string, previous: Need, brands: string[]): Need {
  const lower = message.toLowerCase().trim();
  const category = categoryTerms.find(([, term]) => term.test(lower))?.[0];
  const next: Need = category && previous.category && category !== previous.category
    ? { category } : { ...previous, category: category ?? previous.category };
  const normalised = lower.replace(/(?<=\d),(?=\d)/g, '');
  const price = interpretPrice(normalised, previous.price);
  if (price) next.price = price;
  else delete next.price;
  const use = useTerms.find(([, term]) => term.test(lower))?.[0];
  if (use) next.use = use;
  if (/\b(lightweight|light weight|portable|easy to carry)\b/.test(lower)) next.portable = true;
  if (/\b(weight doesn.t matter|any weight)\b/.test(lower)) delete next.portable;
  const ram = lower.match(/\b(\d{1,3})\s*gb\s*(?:of\s+)?ram\b|\bram\s*(?:of|at least)?\s*(\d{1,3})\s*gb\b/);
  if (ram) next.ram = Number(ram[1] ?? ram[2]);
  if (/\b(any ram|ram doesn.t matter)\b/.test(lower)) delete next.ram;
  if (/\bbluetooth\b/.test(lower)) next.bluetooth = true;
  if (/\b(no bluetooth|bluetooth doesn.t matter)\b/.test(lower)) delete next.bluetooth;
  const words = lower.split(/[^a-z0-9]+/);
  const brand = brands.find(name => words.includes(name.toLowerCase()));
  if (brand) next.brand = brand;
  if (/\b(any brand|brand doesn.t matter)\b/.test(lower)) delete next.brand;
  return next;
}

function spec(variant: Variant, name: string) {
  return Object.entries(variant.specs).find(([key]) => key.toLowerCase() === name)?.[1];
}

export function recommend(variants: Variant[], need: Need) {
  return variants
    .filter(v => v.available > 0 && v.published
      && (!need.category || v.category === need.category)
      && matchesPrice(v.price, need.price)
      && (!need.use || v.uses.some(use => use.toLowerCase() === need.use?.toLowerCase()))
      && (!need.bluetooth || /\bbluetooth\b/i.test(spec(v, 'connectivity') ?? ''))
      && (!need.ram || (parseFloat(spec(v, 'ram') ?? '') >= need.ram)))
    .map(variant => {
      let score = 0;
      const reasons: string[] = [];
      const ram = spec(variant, 'ram');
      const weight = spec(variant, 'weight');
      if (need.use) {
        reasons.push(`Listed for ${need.use.toLowerCase()}`);
      }
      if (need.brand && variant.brand === need.brand) {
        score += 20;
        reasons.push(`Matches your ${need.brand} preference`);
      }
      if (need.portable && weight && /^\d+(?:\.\d+)?\s*kg$/i.test(weight)) {
        score += Math.max(0, 20 - parseFloat(weight) * 5);
        reasons.push(`Weighs ${weight}`);
      }
      if (ram) reasons.push(`${ram} RAM`);
      if (need.bluetooth) reasons.push('Bluetooth connectivity');
      if (need.price) reasons.push('Matches your price criteria');
      return { variant, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.variant.price - b.variant.price || a.variant.sku.localeCompare(b.variant.sku))
    .slice(0, 3);
}
