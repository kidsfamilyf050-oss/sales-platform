const express = require('express')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const DIST = path.join(__dirname, 'dist')

// Hashed assets (JS/CSS bundles) — cache for 1 year, they never change
app.use('/assets', express.static(path.join(DIST, 'assets'), {
  maxAge: '1y',
  immutable: true,
}))

// index.html and everything else — never cache so users always get the latest version
app.use(express.static(DIST, { maxAge: 0 }))

// SPA fallback — any unknown route serves index.html (React Router handles it)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
  res.sendFile(path.join(DIST, 'index.html'))
})

app.listen(PORT, () => console.log(`Client serving on port ${PORT}`))
