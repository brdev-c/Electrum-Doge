// server/src/controllers/scanElectrumController.js
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function scanDogeElectrumServers(req, res) {
  try {
    const url = 'https://1209k.com/bitcoin-eye/ele.php?chain=doge';
    const resp = await axios.get(url);
    const html = resp.data;
    
    const $ = cheerio.load(html);
    const result = [];

    $('table').eq(0).find('tr').each((i, el) => {
      if (i === 0) return; // пропустить заголовок
      const tds = $(el).find('td');
      if (tds.length < 11) return;

      const host   = $(tds[0]).text().trim();
      const port   = $(tds[1]).text().trim();
      const proto  = $(tds[2]).text().trim(); // "tcp" / "ssl"
      const status = $(tds[10]).text().trim(); // "OK" / ...

      if (status === 'OK') {
        result.push({
          host,
          port: parseInt(port, 10) || 50002,
          proto
        });
      }
    });

    res.json(result);
  } catch (err) {
    console.error('scanDogeElectrumServers error:', err);
    return res.status(500).json({ error: 'Failed to scan servers' });
  }
}
