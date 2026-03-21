export function sendServerError(res, message, error) {
  console.error(message, error);
  return res.status(500).json({ error: message });
}
