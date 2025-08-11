export default async function handler(req, res) {
  res.status(200).json({
    method: req.method,
    url: req.url,
    headers: req.headers,
  })
}

