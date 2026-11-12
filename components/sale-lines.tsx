'use client';
import { useState } from 'react';
import { money, type Variant } from '../lib/types';

export function SaleLines({ variants }: { variants: Variant[] }) {
  const [count, setCount] = useState(1);
  return <>
    {Array.from({ length: count }, (_, index) => <div className="form-grid" key={index}>
      <label>Item {index + 1}<select name="variant" required defaultValue=""><option value="" disabled>Select a variant</option>{variants.map(item => <option value={item.id} key={item.id}>{item.product} · {item.name} · {money(item.price)} ({item.available} available)</option>)}</select></label>
      <label>Quantity<input type="number" min="1" max="99" name="quantity" defaultValue="1" required/></label>
    </div>)}
    <div className="prompt-row"><button className="button soft" type="button" disabled={count >= 30} onClick={() => setCount(count + 1)}>Add line</button>
    {count > 1 && <button className="text-button" type="button" onClick={() => setCount(count - 1)}>Remove last line</button>}</div>
  </>;
}
