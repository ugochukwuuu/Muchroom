'use client';
import { useActionState, useRef } from 'react';
import { ArrowUp, RotateCcw, Sparkles } from 'lucide-react';
import { findProducts } from '../app/finder-actions';
import { describePrice } from '../lib/recommender';
import { ProductCard } from './product';

const examples = ['Laptop for lectures under ₦300k', 'Laptop for coding under ₦400k', 'Projector for group presentations'];

export function Finder() {
  const [state, submit, pending] = useActionState(findProducts, { need: {}, matches: [], reply: '', query: '' });
  const input = useRef<HTMLInputElement>(null);
  const { category, price, use, ram, brand, portable, bluetooth } = state.need;
  const criteria = [category, use, ...describePrice(price), ram && `At least ${ram} GB RAM`, brand, portable && 'Lightweight preferred', bluetooth && 'Bluetooth'].filter(Boolean);
  return <>
    <div className="finder-panel panel">
      <div className="finder-icon"><Sparkles size={25}/></div>
      <h1>Find tech for uni.</h1><p className="muted">Tell us what you need for lectures, projects or life off campus, and how much you want to spend. We’ll look through what’s in stock.</p>
      <form action={submit} className="finder-form">
        <input ref={input} name="query" aria-label="Describe the gear you need" maxLength={500} placeholder="I need a laptop for lectures under ₦300k…"/>
        <button className="button primary" disabled={pending} aria-label="Find products"><ArrowUp size={20}/></button>
      </form>
      <div className="prompt-row">{examples.map(example => <button className="chip" key={example} type="button" onClick={() => {
        if (input.current) { input.current.value = example; input.current.focus(); }
      }}>{example}</button>)}</div>
    </div>
    <div className="finder-results" aria-live="polite" aria-busy={pending}>
      {state.query && <>
        <div className="section-head"><div><p className="eyebrow">YOUR REQUEST</p><h2>{state.query}</h2></div>
        <form action={submit}><button className="button soft" name="reset" value="1" disabled={pending}><RotateCcw size={15}/> Start over</button></form></div>
        {!!criteria.length && <div className="prompt-row">{criteria.map(item => <span className="chip" key={String(item)}>{item}</span>)}</div>}
        <p>{state.reply}</p>
        {state.matches.length > 0 && <div className="product-grid">{state.matches.map(({ variant, reasons }) => <ProductCard key={variant.id} variant={variant} reasons={reasons}/>)}</div>}
      </>}
      {pending && <p>Finding available products…</p>}
    </div>
  </>;
}
