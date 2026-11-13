// Builds a product listing query from request query parameters:
// keyword search, whitelisted filters, sorting and pagination.

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  price: { price: 1 },
  '-price': { price: -1 },
  ratings: { ratings: 1 },
  '-ratings': { ratings: -1 },
};

// Accepts both "price[gte]=10" as a literal key and as a nested object,
// because the query parser differs between Express versions and settings.
const readRange = (queryStr, field) => {
  const range = {};
  for (const op of ['gte', 'lte', 'gt', 'lt']) {
    const nested = queryStr[field] && typeof queryStr[field] === 'object' ? queryStr[field][op] : undefined;
    const raw = queryStr[`${field}[${op}]`] ?? nested;
    const value = Number(raw);
    if (raw !== undefined && raw !== '' && Number.isFinite(value)) range[`$${op}`] = value;
  }
  return range;
};

class ApiFeatures {
  constructor(query, queryStr, defaultLimit = 12) {
    this.query = query;
    this.queryStr = queryStr || {};
    this.page = Math.max(1, parseInt(this.queryStr.page, 10) || 1);
    this.limit = Math.min(50, Math.max(1, parseInt(this.queryStr.limit, 10) || defaultLimit));
  }

  search() {
    const { keyword } = this.queryStr;
    if (typeof keyword === 'string' && keyword.trim()) {
      this.query = this.query.find({ name: { $regex: escapeRegex(keyword.trim()), $options: 'i' } });
    }
    return this;
  }

  filter() {
    const filters = {};
    if (typeof this.queryStr.category === 'string' && this.queryStr.category) {
      filters.category = this.queryStr.category;
    }
    for (const field of ['price', 'ratings']) {
      const range = readRange(this.queryStr, field);
      if (Object.keys(range).length) filters[field] = range;
    }
    if (this.queryStr.inStock === 'true') filters.stock = { $gt: 0 };
    this.query = this.query.find(filters);
    return this;
  }

  sort() {
    this.query = this.query.sort(SORTS[this.queryStr.sort] || SORTS.newest);
    return this;
  }

  paginate() {
    this.query = this.query.skip(this.limit * (this.page - 1)).limit(this.limit);
    return this;
  }
}

export default ApiFeatures;
