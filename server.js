const express = require('express')
const fetch   = require('node-fetch')
const app     = express()
const PORT    = process.env.PORT || 3000

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', '*')
  next()
})

app.get('/proxy', async (req, res) => {
  const target = req.query.url
  if (!target) return res.status(400).send('Missing ?url=')

  const targetUrl = decodeURIComponent(target)
  let targetHost = ''
  try { targetHost = new URL(targetUrl).hostname } catch(e) { return res.status(400).send('Invalid URL') }

  // Headers base
  const headers = {
    'Accept': '*/*',
    'Accept-Language': 'it-IT,it;q=0.9',
  }

  // RAI — User-Agent Apple TV obbligatorio
  if (targetHost.includes('rai.it') || (targetHost.includes('akamaized.net') && targetUrl.includes('rai'))) {
    headers['User-Agent'] = 'AppleCoreMedia/1.0.0.19H12 (Apple TV; U; CPU OS 15_6 like Mac OS X; it_it)'
  }
  // Mediaset
  else if (targetHost.includes('mediaset.net')) {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    headers['Origin']  = 'https://www.mediasetplay.mediaset.it'
    headers['Referer'] = 'https://www.mediasetplay.mediaset.it/'
  }
  // Sky
  else if (targetHost.includes('skycdn.it') || targetHost.includes('akamaized.net')) {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    headers['Origin']  = 'https://www.sky.it'
    headers['Referer'] = 'https://www.sky.it/'
  }
  // Default
  else {
    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }

  try {
    const response = await fetch(targetUrl, { headers, redirect: 'follow' })
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('mpegurl') || targetUrl.includes('.m3u8')) {
      let body = await response.text()
      const base = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1)
      const proxyBase = `${req.protocol}://${req.get('host')}/proxy?url=`

      body = body.replace(/^(?!#)(?!https?:\/\/)(.+\.m3u8[^\s]*)$/gm, (match) => {
        return proxyBase + encodeURIComponent(new URL(match.trim(), base).href)
      })
      body = body.replace(/^(https?:\/\/.+\.m3u8[^\s]*)$/gm, (match) => {
        return proxyBase + encodeURIComponent(match.trim())
      })
      body = body.replace(/^(?!#)(?!https?:\/\/)(.+\.ts[^\s]*)$/gm, (match) => {
        return new URL(match.trim(), base).href
      })

      res.set('Content-Type', 'application/vnd.apple.mpegurl')
      return res.send(body)
    }

    res.set('Content-Type', contentType || 'application/octet-stream')
    response.body.pipe(res)

  } catch(e) {
    res.status(500).send('Proxy error: ' + e.message)
  }
})

app.get('/health', (_, res) => res.send('OK'))
app.get('/', (_, res) => res.send('Mediaset Proxy v2 attivo'))

app.listen(PORT, () => console.log('Proxy v2 avviato porta', PORT))
