// Reads ?page and ?limit and returns what a list endpoint needs
export const getPagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query?.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query?.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

// The paging fields every list response carries
export const pageInfo = (count, { page, limit }) => ({
  count,
  currentPage: page,
  totalPages: Math.ceil(count / limit),
});

// Runs a find with paging and counts the full result in parallel
export const paginate = async (model, filter, pagination, { sort = { createdAt: -1 }, populate } = {}) => {
  let query = model.find(filter).sort(sort).skip(pagination.skip).limit(pagination.limit);
  if (populate) query = query.populate(...populate);
  const [items, count] = await Promise.all([query, model.countDocuments(filter)]);
  return { items, ...pageInfo(count, pagination) };
};
