# 🗞️ Briefing - RSS Dashboard

A beautiful, card-based RSS feed aggregator dashboard built with Python and vanilla JavaScript. Get your daily news and information from multiple sources in one clean, responsive interface.

![Dashboard Preview](https://img.shields.io/badge/Python-3.9+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Features

- 📰 **RSS Feed Aggregation** - Fetch and display articles from multiple RSS/Atom feeds
- 🎨 **Card-Based UI** - Modern, responsive design with beautiful cards
- 🌓 **Dark Mode** - Toggle between light and dark themes
- ⚡ **Smart Caching** - 15-minute cache to reduce load on RSS sources
- 🔄 **Auto-Refresh** - Automatically updates every 5 minutes
- 📱 **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- ⚙️ **Easy Configuration** - Simple JSON file for managing feeds
- 🚀 **Zero Dependencies** - Pure Python standard library, no external packages needed

## 🚀 Quick Start

### Prerequisites

- Python 3.9 or higher

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd ~/Projects/Briefing
   ```

2. **Start the server:**
   ```bash
   python3 server.py
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3001`

That's it! Your dashboard is now running.

## ⚙️ Configuration

### Adding/Removing RSS Feeds

Edit the `feeds.json` file to customize your feeds:

```json
{
  "feeds": [
    {
      "name": "TechCrunch",
      "url": "https://techcrunch.com/feed/",
      "enabled": true
    },
    {
      "name": "Your Custom Feed",
      "url": "https://example.com/rss",
      "enabled": true
    }
  ],
  "settings": {
    "cacheTTL": 900,
    "maxItemsPerFeed": 20,
    "autoRefreshInterval": 300,
    "port": 3001
  }
}
```

#### Feed Options

- **name** - Display name for the feed (appears as badge on cards)
- **url** - RSS/Atom feed URL
- **enabled** - Set to `false` to temporarily disable a feed without removing it

#### Settings Options

- **cacheTTL** - Cache time-to-live in seconds (default: 900 = 15 minutes)
- **maxItemsPerFeed** - Maximum articles to fetch per feed (default: 20)
- **autoRefreshInterval** - Auto-refresh interval in seconds (default: 300 = 5 minutes)
- **port** - Server port (default: 3001)

### Finding RSS Feeds

Here are some popular RSS feeds to get you started:

**Technology:**
- TechCrunch: `https://techcrunch.com/feed/`
- The Verge: `https://www.theverge.com/rss/index.xml`
- Hacker News: `https://hnrss.org/frontpage`
- Ars Technica: `http://feeds.arstechnica.com/arstechnica/index`

**News:**
- BBC News: `https://feeds.bbci.co.uk/news/rss.xml`
- Reuters: `https://www.reutersagency.com/feed/`
- NPR News: `https://feeds.npr.org/1001/rss.xml`

**Design:**
- Smashing Magazine: `https://www.smashingmagazine.com/feed/`
- CSS-Tricks: `https://css-tricks.com/feed/`

**How to find RSS feeds:**
1. Look for RSS icon (🟠) on websites
2. Check website footer for "RSS" or "Feed" links
3. Try adding `/feed/`, `/rss`, or `/feed.xml` to the website URL
4. Use RSS feed discovery tools like Feedly or RSS.app

## 🎨 Using the Dashboard

### Basic Features

- **Manage Button** - Open the feed management interface to organize and configure feeds
- **Refresh Button** - Manually refresh all feeds and clear cache
- **Theme Toggle** - Switch between light and dark mode (☀️/🌙)
- **Click on Cards** - Opens the full article in a new tab
- **Auto-Refresh** - Dashboard automatically updates every 5 minutes

### Feed Management Page

Access the management page by clicking the **⚙️ Manage** button in the header or visiting `http://localhost:3001/manage.html`

**Features:**
- **Organize by Category** - Group feeds into categories for better organization
- **Enable/Disable Feeds** - Toggle individual feeds or entire categories on/off
- **Add New Feeds** - Add RSS feeds with custom names and categories
- **Edit Feeds** - Modify feed names, URLs, and categories
- **Delete Feeds** - Remove unwanted feeds
- **Search** - Quickly find feeds by name or URL
- **Bulk Actions** - Enable/disable all feeds in a category at once
- **Live Stats** - See total feeds, enabled/disabled counts, and category counts

### Card Information

Each card displays:
- Featured image (when available)
- Source badge (feed name)
- Article title
- Article description/excerpt
- Relative timestamp ("2 hours ago")
- Read more link

## 🛠️ Development

### File Structure

```
~/Projects/Briefing/
├── server.py              # Python backend server
├── feeds.json             # Feed configuration
├── README.md              # This file
└── public/
    ├── index.html         # Main HTML page
    ├── css/
    │   └── styles.css     # Styling and themes
    └── js/
        └── app.js         # Frontend application logic
```

### Customization

#### Changing the Port

Edit `feeds.json` and change the `port` setting:

```json
{
  "settings": {
    "port": 8080
  }
}
```

#### Adjusting Cache Duration

Edit `feeds.json` and change `cacheTTL` (in seconds):

```json
{
  "settings": {
    "cacheTTL": 1800
  }
}
```

#### Customizing Colors

Edit `public/css/styles.css` and modify the CSS variables in the `:root` section:

```css
:root {
    --accent-primary: #6366f1;  /* Change to your preferred color */
    --accent-secondary: #8b5cf6;
}
```

## 🐛 Troubleshooting

### Server won't start

**Error:** `Address already in use`

**Solution:** Another application is using port 3001. Either:
- Stop the other application
- Change the port in `feeds.json`

### Feeds not loading

**Possible causes:**
1. **Invalid feed URL** - Verify the URL in a browser
2. **CORS restrictions** - The Python server handles CORS automatically
3. **Feed is down** - Try accessing the feed URL directly
4. **Timeout** - Some feeds are slow; wait or increase timeout in server.py

**How to test a feed:**
```bash
curl -I https://techcrunch.com/feed/
```

### No images showing

Some feeds don't include images. This is normal. The dashboard will show a placeholder icon (📰) for articles without images.

### Dark mode not persisting

Make sure your browser allows localStorage. Check browser console for errors.

## 📝 API Endpoints

The server exposes these endpoints:

- `GET /api/feeds` - Fetch all enabled feeds and return aggregated articles
- `POST /api/refresh` - Clear cache and force refresh
- `GET /api/config` - Get current configuration from feeds.json

## 🔮 Future Enhancements

Potential features for future versions:

- [ ] Web scraping support for non-RSS sources
- [ ] Feed management UI (add/edit/delete feeds from dashboard)
- [ ] Search and filter articles
- [ ] Mark articles as read/unread
- [ ] Favorite/bookmark articles
- [ ] Feed categories and organization
- [ ] Keyboard shortcuts
- [ ] Export articles to markdown
- [ ] AI-powered article summaries
- [ ] Multi-user support

## 📄 License

MIT License - Feel free to use and modify as you wish!

## 🙏 Acknowledgments

- Built with Python's standard library
- Uses vanilla JavaScript (no frameworks!)
- Inspired by modern news aggregators like Feedly and Inoreader

## 💡 Tips

- **Curate your feeds** - Quality over quantity. 5-10 good feeds is better than 50 mediocre ones.
- **Check feeds regularly** - Some RSS feeds are abandoned or move URLs.
- **Use categories** - Group similar feeds together (e.g., all tech feeds at the top).
- **Adjust refresh rate** - If you check infrequently, increase cacheTTL to reduce server load.
- **Mobile bookmarks** - Add to your phone's home screen for quick access.

---

**Enjoy your personalized news dashboard! 🎉**

For questions or issues, feel free to modify and extend this project to fit your needs.
