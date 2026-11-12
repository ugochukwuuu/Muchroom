'use server';
import { catalogue } from '../lib/catalogue';
import { interpret, recommend, type Need } from '../lib/recommender';

export type FinderState = {
  need: Need;
  matches: ReturnType<typeof recommend>;
  reply: string;
  query: string;
};

export async function findProducts(previous: FinderState, form: FormData): Promise<FinderState> {
  if (form.get('reset')) return { need: {}, matches: [], reply: '', query: '' };
  const query = String(form.get('query') ?? '').trim().slice(0, 500);
  if (!query) return previous;
  const items = await catalogue();
  const brands = [...new Set(items.map(item => item.brand).filter(Boolean))];
  const need = interpret(query, previous.need, brands);
  const hasCriteria = Boolean(need.category || need.price || need.use || need.brand || need.ram || need.portable || need.bluetooth);
  if (!hasCriteria) return { need, matches: [], reply: 'Tell us the type of product, what you’ll use it for, or your budget.', query };
  const matches = recommend(items, need);
  return { need, matches, reply: matches.length
    ? `Found ${matches.length} ${matches.length === 1 ? 'match' : 'matches'}.`
    : 'No in-stock products match your request. Try adjusting the price or other requirements.', query };
}
