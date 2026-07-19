const express = require('express');
const cheerio = require('cheerio');
const RSS = require('rss');

const app = express();
const PORT = process.env.PORT || 3000;


let gotScrapingInstance = null;
const getGotScraping = async () => {
    if (!gotScrapingInstance) {
        const { gotScraping } = await import('got-scraping');
        gotScrapingInstance = gotScraping;
    }
    return gotScrapingInstance;
};

// Pengganti Axios untuk fetchUrl generik (Badilum & PT Makassar)
const fetchUrl = async (url) => {
    const scraper = await getGotScraping();
    const response = await scraper({
        url: url,
        method: 'GET',
        timeout: { request: 15000 },
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome' }],
            devices: ['desktop'],
            operatingSystems: ['windows'],
        }
    });
    // Mengembalikan objek tiruan agar `.data` di kode lama tidak patah
    return { data: response.body };
};

const cleanUrl = (link, baseUrl) => {
    if (!link) return null;
    if (link.startsWith('http')) return link;
    try {
        const urlObj = new URL(baseUrl);
        if (link.startsWith('/')) {
            return urlObj.origin + link;
        } else {
            const parts = urlObj.pathname.split('/');
            parts.pop();
            const parentPath = parts.join('/');
            return urlObj.origin + parentPath + '/' + link;
        }
    } catch (e) {
        return link;
    }
};

const parseIndoDate = (str) => {
    if (!str) return null;
    const months = {
        'januari': '01', 'februari': '02', 'maret': '03', 'april': '04', 'mei': '05', 'juni': '06',
        'juli': '07', 'agustus': '08', 'september': '09', 'oktober': '10', 'november': '11', 'desember': '12',
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05', 'jun': '06',
        'jul': '07', 'agu': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'des': '12'
    };
    let clean = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    const parts = clean.split(/\s+/);

    let day, month, year, time = '00:00:00';

<<<<<<< HEAD
=======
    // Pattern: 13 Maret 2026 or 13-Mar-2026
    // find index that is a month name
>>>>>>> 373442b16dc1a61c1a326cb6df49c5833fb3406e
    let monthIdx = parts.findIndex(p => months[p]);
    if (monthIdx !== -1) {
        month = months[parts[monthIdx]];
        day = parts[monthIdx - 1];
        year = parts[monthIdx + 1];
        let timePart = parts.find(p => p.includes(':'));
        if (timePart) time = timePart;
    } else {
        const d = parts.filter(p => /^\d+$/.test(p));
        if (d.length >= 3) {
            day = d[0]; month = d[1]; year = d[2];
        }
    }

    if (day && month && year) {
        const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}`;
        const d = new Date(iso);
        return isNaN(d.getTime()) ? str : d;
    }
    return str;
};

// Generic parser for Joomla/WordPress style news lists
const parseGenericNews = (html, baseUrl) => {
    const $ = cheerio.load(html);
    const items = [];

<<<<<<< HEAD
=======
    // Selectors biasanya mengandung judul
>>>>>>> 373442b16dc1a61c1a326cb6df49c5833fb3406e
    const titleSelectors = [
        '.item-title a', '.article-title a', '.page-header a',
        'h2.title a', 'h3.title a', 'h1.title a',
        '.blog h2 a', '.blog h3 a',
        '.category-list td.list-title a',
        '.art-postheader a',
        'table.zebra td a', 'table tbody td:first-child a',
        '.postheader a', 'h2.postheader'
    ];

    let elements = [];
    for (let sel of titleSelectors) {
        const found = $(sel);
        if (found.length > 2) {
            elements = found;
            break;
        }
    }

    if (elements.length === 0) {
        elements = $('h2 a, h3 a, h4 a, dt a');
    }

    elements.each((i, el) => {
        let title = $(el).text().trim().replace(/\s+/g, ' ');
        let link = $(el).attr('href');

        if (!link) {
            const parent = $(el).closest('.art-post, .post, .item, .article, .blog-post, div');
            link = parent.find('a[href*="/berita/"], a[href*="/en/berita/"], a.csbutton-color, a.readmore').first().attr('href');
        }

        if (!title || !link || link === '#') return;
        link = cleanUrl(link, baseUrl);

        let description = '';
        let date = null;
        let parent = $(el).closest('.art-post, .post, .item, .article, .blog-post, .row, div, tr');
        if (parent.length) {
            let dateText = parent.find('.date, .created, .publish_up, .art-postheadericons, time, td:nth-child(2)').text().trim();
            if (dateText) {
                date = parseIndoDate(dateText);
            }

            let pText = parent.find('p, .intro-text').first().text().trim();
            if (pText) description = pText;
        }

        if (!items.find(x => x.url === link) && title.length > 5 && !title.includes('Read more') && !title.includes('baca selengkapnya')) {
            items.push({
                title,
                url: link,
                guid: link,
                description,
                date: date || new Date()
            });
        }
    });

    return items;
};


const fetchMaApi = async (cat_id) => {
    const scraper = await getGotScraping();
    const fd = new URLSearchParams();
    fd.append('cat_id', cat_id);
    fd.append('page', "1");
    fd.append('lang', "id");

    const res = await scraper({
        url: 'https://www.mahkamahagung.go.id/id/berita',
        method: 'POST',
        body: fd.toString(),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': 'https://www.mahkamahagung.go.id/id/berita'
        },
        headerGeneratorOptions: {
            browsers: [{ name: 'chrome' }],
            devices: ['desktop'],
            operatingSystems: ['windows'],
        }
    });

    const data = JSON.parse(res.body);

    if (data && data.stat === 'OK' && data.data && data.data.rows) {
        return data.data.rows.map(item => ({
            title: item.title,
            url: item.url,
            guid: item.url,
            description: `${item.pt || ''} - ${item.author || ''}`,
            date: parseIndoDate(item.pt) || new Date()
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
        console.log(e);
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
        const url = 'https://pt-makassar.go.id/';
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

module.exports = app;

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`RSS Scraper server running on http://localhost:${PORT}`);
    });
}