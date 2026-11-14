// Every successful response has the same envelope: { success, message, data }
export const sendResponse = (res, statusCode, message, data = null) =>
  res.status(statusCode).json({ success: true, message, data });
