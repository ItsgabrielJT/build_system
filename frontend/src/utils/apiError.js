const formatLocation = (loc) => {
  if (!Array.isArray(loc)) return '';
  return loc.filter((part) => part !== 'body').join('.');
};

const formatDetailItem = (item) => {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';

  const message = item.msg || item.message;
  if (!message) return '';

  const location = formatLocation(item.loc);
  return location ? `${location}: ${message}` : message;
};

export const formatApiError = (errorOrDetail, fallback = 'Ocurrió un error') => {
  const detail = errorOrDetail?.response?.data?.detail
    ?? errorOrDetail?.detail
    ?? errorOrDetail;

  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    return detail.map(formatDetailItem).filter(Boolean).join('\n') || fallback;
  }

  if (typeof detail === 'object') {
    return detail.msg || detail.message || fallback;
  }

  return String(detail);
};
