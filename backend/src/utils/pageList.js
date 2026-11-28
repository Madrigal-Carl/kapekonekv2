/**
 * One numbered page of a Mongoose query, for dashboard tables: `{ items, meta: { page, limit, total } }`.
 * @param {import('mongoose').Query} query a find() with its filter and sort
 * @param {{ page: number, limit: number }} paging
 */
export async function pageList(query, { page, limit }) {
  const [items, total] = await Promise.all([
    query.clone().skip((page - 1) * limit).limit(limit).lean(),
    query.model.countDocuments(query.getFilter()),
  ]);
  return { items, meta: { page, limit, total } };
}
