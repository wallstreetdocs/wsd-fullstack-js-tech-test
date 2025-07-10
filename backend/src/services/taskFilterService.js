export const buildTaskQuery = (filters) => {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;

  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }

  return query;
};
