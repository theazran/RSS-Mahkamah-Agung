const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const RSS = require('rss');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper to make generic HTTP request with typical browser user-agent
const fetchUrl = async (url) => {
    return axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });
};

const cleanUrl = (link, baseUrl) => {
    if (!link) return null;
    if (link.startsWith('http')) return link;
    try {
        const urlObj = new URL(baseUrl);
        if (link.startsWith('/')) {
            return urlObj.origin + link;
        } else {
            // relative link
            const parts = urlObj.pathname.split('/');
            parts.pop();
            const parentPath = parts.join('/');
            return urlObj.origin + parentPath + '/' + link;
        }
    } catch (e) {
        return link;
    }
};

// Generic parser for Joomla/WordPress style news lists
const parseGenericNews = (html, baseUrl) => {
    const $ = cheerio.load(html);
    const items = [];
    
    // Selectors usually containing titles with links in Joomla/WP
    const titleSelectors = [
        '.item-title a', '.article-title a', '.page-header a',
        'h2.title a', 'h3.title a', 'h1.title a',
        '.blog h2 a', '.blog h3 a', 
        '.category-list td.list-title a', 
        '.art-postheader a',
        'table.zebra td a', 'table tbody td:first-child a',
        '.postheader a', 'h2.postheader' // Added h2.postheader for PT Makassar/Artisteer
    ];

    let elements = [];
    for (let sel of titleSelectors) {
        const found = $(sel);
        if (found.length > 2) {
            elements = found;
            break;
        }
    }

    // Fallback if none of the above match well
    if (elements.length === 0) {
        elements = $('h2 a, h3 a, h4 a, dt a');
    }

    elements.each((i, el) => {
        let title = $(el).text().trim().replace(/\s+/g, ' ');
        let link = $(el).attr('href');
        
        // If the element itself is not a link (like h2.postheader), look for the link in the parent or siblings
        if (!link) {
            const parent = $(el).closest('.art-post, .post, .item, .article, .blog-post, div');
            link = parent.find('a[href*="/berita/"], a[href*="/en/berita/"], a.csbutton-color, a.readmore').first().attr('href');
        }

        if (!title || !link || link === '#') return;
        link = cleanUrl(link, baseUrl);
        
        let description = '';
        let parent = $(el).closest('.art-post, .post, .item, .article, .blog-post, .row, div');
        if (parent.length) {
            let pText = parent.find('p, .intro-text, td:nth-child(2)').first().text().trim();
            if (pText) description = pText;
        }

        if (!items.find(x => x.url === link) && title.length > 5 && !title.includes('Read more') && !title.includes('baca selengkapnya')) {
            items.push({ 
                title, 
                url: link, 
                guid: link,
                description 
            });
        }
    });

    return items;
};

// MA API fetcher
const fetchMaApi = async (cat_id) => {
    const fd = new URLSearchParams();
    fd.append('cat_id', cat_id);
    fd.append('page', "1");
    fd.append('lang', "id");

    const res = await axios.post('https://mahkamahagung.go.id/id/berita', fd.toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
        }
    });

    if (res.data && res.data.stat === 'OK' && res.data.data && res.data.data.rows) {
        return res.data.data.rows.map(item => ({
            title: item.title,
            url: item.url,
            guid: item.url,
            description: `${item.pt || ''} - ${item.author || ''}`,
            date: item.pt || new Date()
        }));
    }
    return [];
};

app.get('/rss/ma/berita', async (req, res) => {
    try {
        const items = await fetchMaApi("1");
        const feed = new RSS({ 
            title: 'MA - Berita', 
            site_url: 'https://mahkamahagung.go.id/id/berita',
            feed_url: `https://${req.get('host')}/rss/ma/berita`
        });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/rss/ma/pengumuman', async (req, res) => {
    try {
        const items = await fetchMaApi("2");
        const feed = new RSS({ 
            title: 'MA - Pengumuman', 
            site_url: 'https://mahkamahagung.go.id/id/pengumuman',
            feed_url: `https://${req.get('host')}/rss/ma/pengumuman`
        });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/rss/badilum/berita', async (req, res) => {
    try {
        const url = 'https://badilum.mahkamahagung.go.id/berita/berita-kegiatan.html';
        const response = await fetchUrl(url);
        const items = parseGenericNews(response.data, url);
        const feed = new RSS({ 
            title: 'Badilum - Berita Kegiatan', 
            site_url: url,
            feed_url: `https://${req.get('host')}/rss/badilum/berita`
        });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/rss/badilum/pengumuman', async (req, res) => {
    try {
        const url = 'https://badilum.mahkamahagung.go.id/berita/pengumuman-surat-dinas.html';
        const response = await fetchUrl(url);
        const items = parseGenericNews(response.data, url);
        const feed = new RSS({ 
            title: 'Badilum - Pengumuman Surat Dinas', 
            site_url: url,
            feed_url: `https://${req.get('host')}/rss/badilum/pengumuman`
        });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/rss/pt-makassar/berita', async (req, res) => {
    try {
        const url = 'https://pt-makassar.go.id/en/berita/berita-terkini';
        const response = await fetchUrl(url);
        const items = parseGenericNews(response.data, url);
        const feed = new RSS({ 
            title: 'PT Makassar - Berita Terkini', 
            site_url: url,
            feed_url: `https://${req.get('host')}/rss/pt-makassar/berita`
        });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/', (req, res) => {
    const host = req.get('host');
    const links = [
        { name: 'MA - Berita', path: '/rss/ma/berita' },
        { name: 'MA - Pengumuman', path: '/rss/ma/pengumuman' },
        { name: 'Badilum - Berita Kegiatan', path: '/rss/badilum/berita' },
        { name: 'Badilum - Pengumuman Surat Dinas', path: '/rss/badilum/pengumuman' },
        { name: 'PT Makassar - Berita Terkini', path: '/rss/pt-makassar/berita' }
    ];

    let html = `
    <html>
    <head>
        <title>RSS Scraper Mahkamah Agung</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; background: #fdfdfd; }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            ul { list-style: none; padding: 0; }
            li { background: #fff; margin-bottom: 10px; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
            a { color: #3498db; text-decoration: none; font-weight: bold; }
            a:hover { text-decoration: underline; }
            .copy-btn { background: #3498db; color: #fff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; }
            code { background: #f8f9fa; padding: 2px 5px; border-radius: 3px; font-size: 13px; color: #e83e8c; }
        </style>
    </head>
    <body>
        <h1>RSS Scraper Mahkamah Agung</h1>
        <p>Gunakan link berikut untuk mengakses data RSS:</p>
        <ul>
            ${links.map(l => `
                <li>
                    <span><strong>${l.name}</strong></span>
                    <div>
                        <code>https://${host}${l.path}</code> 
                        <a href="${l.path}" style="margin-left: 10px;">Link Feed</a>
                    </div>
                </li>
            `).join('')}
        </ul>
    </body>
    </html>
    `;
    res.send(html);
});

// Export app untuk Vercel
module.exports = app;

// Jalankan server jika dijalankan secara lokal
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`RSS Scraper server running on http://localhost:${PORT}`);
    });
}
