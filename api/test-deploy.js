export default async function handler(req, res) {
  const now = new Date()
  return res.status(200).json({
    ok: true,
    message: "Deployment successful!",
    timestamp: now.toISOString(),
    hour: now.getHours(),
    method: req.method,
    deployVersion: "v2025-08-21-23:52"
  })
}