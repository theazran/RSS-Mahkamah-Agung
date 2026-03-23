const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const RSS = require('rss');

const app = express();
const PORT = 3000;

// Helper to make generic HTTP request with typical browser user-agent
const fetchUrl = async (url) => {
    return axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });
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
        'table.zebra td a', 'table tbody td:first-child a'
    ];

    let elements = null;
    for (let sel of titleSelectors) {
        if ($(sel).length > 1) {
            elements = $(sel);
            break;
        }
    }

    // Fallback if none of the above match well
    if (!elements || elements.length === 0) {
        // Just find headers with links
        elements = $('h2 a, h3 a, h4 a, dt a');
    }

    elements.each((i, el) => {
        let title = $(el).text().trim().replace(/\\s+/g, ' ');
        let link = $(el).attr('href');
        if (!title || !link || link === '#') return;
        if (link.startsWith('/')) {
            const urlObj = new URL(baseUrl);
            link = urlObj.origin + link;
        }
        
        let description = '';
        // Try to find description by traversing up and finding text
        let parent = $(el).closest('.item, .article, .blog-post, .row, .art-post-inner, div');
        if (parent.length) {
            let pText = parent.find('p, .intro-text, td:nth-child(2)').first().text().trim();
            if (pText) description = pText;
        }

        // Only add if not duplicate
        if (!items.find(x => x.link === link) && title.length > 5 && !title.includes('Read more') && !title.includes('baca selengkapnya')) {
            items.push({ title, link, description });
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
            link: item.url,
            description: `${item.pt || ''} - ${item.author || ''}`,
            date: new Date() // No date provided by API directly in rows usually, so use current. Could parse if needed.
        }));
    }
    return [];
};

app.get('/rss/ma/berita', async (req, res) => {
    try {
        const items = await fetchMaApi("1");
        const feed = new RSS({ title: 'MA - Berita', site_url: 'https://mahkamahagung.go.id/id/berita' });
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
        const feed = new RSS({ title: 'MA - Pengumuman', site_url: 'https://mahkamahagung.go.id/id/pengumuman' });
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
        const feed = new RSS({ title: 'Badilum - Berita Kegiatan', site_url: url });
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
        const feed = new RSS({ title: 'Badilum - Pengumuman Surat Dinas', site_url: url });
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
        const feed = new RSS({ title: 'PT Makassar - Berita Terkini', site_url: url });
        items.forEach(it => feed.item(it));
        res.set('Content-Type', 'application/rss+xml');
        res.send(feed.xml());
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// Export app untuk Vercel
module.exports = app;

// Jalankan server jika dijalankan secara lokal
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`RSS Scraper server running on http://localhost:${PORT}`);
    });
}
