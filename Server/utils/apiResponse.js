export function normalizeApiResponse(payload) {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload.status === 'string' && (payload.status === 'success' || payload.status === 'error')) {
    return payload;
  }

  const normalized = { ...payload };
  const statusValue = normalized.Status ?? normalized.success ?? normalized.loginStatus ?? normalized.valid;
  const isSuccess = statusValue === true;
  const isError = statusValue === false;

  if (!isSuccess && !isError) {
    return payload;
  }

  const message = normalized.message || normalized.Message || normalized.Error || normalized.error;
  const result = normalized.Result !== undefined ? normalized.Result : normalized.Data !== undefined ? normalized.Data : undefined;

  const excludedKeys = new Set([
    'Status', 'success', 'loginStatus', 'valid',
    'Result', 'Data', 'Message', 'message', 'Error', 'error'
  ]);

  const extraFields = Object.keys(normalized).reduce((acc, key) => {
    if (!excludedKeys.has(key)) acc[key] = normalized[key];
    return acc;
  }, {});

  const response = { status: isSuccess ? 'success' : 'error' };

  if (isSuccess && !message && normalized.loginStatus) {
    response.message = 'Logged in successfully';
  } else if (isSuccess && !message && normalized.valid) {
    response.message = 'Token valid';
  } else if (message) {
    response.message = message;
  }

  if (result !== undefined) {
    response.data = result;
  } else if (Object.keys(extraFields).length > 0) {
    response.data = extraFields;
  }

  return response;
}
