# 🗞️ Briefing - RSS Dashboard v1.1

A beautiful, card-based RSS feed aggregator and calendar dashboard built with Python and vanilla JavaScript. Get your daily news and schedule from multiple sources in one clean, responsive interface.

![Dashboard Preview](https://img.shields.io/badge/Python-3.9+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Version](https://img.shields.io/badge/version-1.1-blue.svg)

## ✨ Features

- 📰 **RSS Feed Aggregation** - Fetch and display articles from multiple RSS/Atom feeds
- 📅 **Calendar Integration** - Display today's events from iCal/ICS calendar feeds
- 🔄 **Recurring Events** - Full support for daily, weekly, monthly, and yearly recurring events
- 🎨 **Card-Based UI** - Modern, responsive design with beautiful cards
- 🏷️ **Category Organization** - Organize feeds and articles by category
- 🌓 **Dark Mode** - Toggle between light and dark themes
- ⚡ **Smart Caching** - 15-minute cache to reduce load on RSS and calendar sources
- 🔄 **Auto-Refresh** - Automatically updates every 5 minutes
- 📱 **Responsive Design** - Works perfectly on mobile, tablet, and desktop
- ⚙️ **Management UI** - Web interface for managing feeds and calendars
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

### Using the Management Interface

The easiest way to manage feeds and calendars is through the web UI:

1. Click the **⚙️ Manage** button in the header
2. Or visit `http://localhost:3001/manage.html`

**Features:**
- Add/edit/delete RSS feeds and calendars
- Toggle feeds and calendars on/off
- Organize feeds by category
- See live statistics
- Save changes with one click

### Manual Configuration (feeds.json)

You can also edit the `feeds.json` file directly:

```json
{
  "feeds": [
    {
      "name": "TechCrunch",
      "url": "https://techcrunch.com/feed/",
      "enabled": true,
      "category": "Technology"
    }
  ],
  "calendar": {
    "sources": [
      {
        "name": "Work Calendar",
        "url": "https://calendar.google.com/calendar/ical/your-calendar/basic.ics",
        "enabled": true
      },
      {
        "name": "US Holidays",
        "url": "https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics",
        "enabled": true
      }
    ]
  },
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
- **category** - Group feeds by category (e.g., "Technology", "News", "Sports")

#### Calendar Options

- **name** - Display name for the calendar
- **url** - iCal/ICS feed URL (works with Google Calendar, Apple Calendar, Outlook, etc.)
- **enabled** - Set to `false` to temporarily disable a calendar without removing it

#### Settings Options

- **cacheTTL** - Cache time-to-live in seconds (default: 900 = 15 minutes)
- **maxItemsPerFeed** - Maximum articles to fetch per feed (default: 20)
- **autoRefreshInterval** - Auto-refresh interval in seconds (default: 300 = 5 minutes)
- **port** - Server port (default: 3001)

### Getting Calendar iCal URLs

**Google Calendar:**
1. Open Google Calendar in a web browser
2. Click the three dots next to your calendar name
3. Select "Settings and sharing"
4. Scroll down to "Integrate calendar"
5. Copy the "Secret address in iCal format" URL

**Apple Calendar (iCloud):**
1. Open iCloud.com and go to Calendar
2. Click the share icon next to your calendar
3. Enable "Public Calendar"
4. Copy the webcal URL (change `webcal://` to `https://`)

**Outlook/Office 365:**
1. Open Outlook on the web
2. Go to Calendar settings
3. Select "Shared calendars"
4. Publish your calendar and copy the ICS link

**Public Holiday Calendars:**
- US Holidays: `https://calendar.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics`
- Many countries have public holiday calendars available through Google Calendar

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

### Main Dashboard

**Sidebar Features:**
- **📅 Today's Schedule** - Shows all events happening today from your calendars
  - Displays event time, title, and description
  - Supports all-day events
  - Shows recurring events (daily, weekly, monthly, yearly)
  - Auto-updates with the rest of the dashboard
- **Categories** - Filter articles by category
  - Click "All Articles" to see everything
  - Click a category to filter by that topic

**Header Controls:**
- **⚙️ Manage** - Open the management interface to configure feeds and calendars
- **🔄 Refresh** - Manually refresh all feeds and calendars, clearing cache
- **☀️/🌙 Theme Toggle** - Switch between light and dark mode

**Article Cards:**
- Featured image (when available, or 📰 placeholder)
- Source badge (feed name)
- Category badge (if categorized)
- Article title and description
- Relative timestamp ("2 hours ago")
- Click anywhere on the card to open the full article

### Management Page

Access the management page by clicking the **⚙️ Manage** button or visiting `http://localhost:3001/manage.html`

**Two tabs available:**

**RSS Feeds Tab:**
- Add new RSS feeds with custom names and categories
- Edit existing feeds (name, URL, category)
- Enable/disable feeds with a toggle
- Delete unwanted feeds
- Search feeds by name or URL
- Filter by category
- Live statistics (total feeds, enabled/disabled counts)

**Calendars Tab:**
- Add calendar sources (iCal/ICS URLs)
- Edit existing calendars (name, URL)
- Enable/disable calendars with a toggle
- Delete calendar sources
- Live statistics (total calendars, enabled count)
- Supports Google Calendar, Apple Calendar, Outlook, and any iCal-compatible service

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
- `GET /api/calendar` - Fetch today's events from all enabled calendars
- `GET /api/config` - Get current configuration from feeds.json
- `POST /api/refresh` - Clear cache and force refresh of feeds and calendars
- `POST /api/save-config` - Save configuration changes from management UI

## 📅 Calendar Features

**Supported Formats:**
- iCal/ICS standard format
- Compatible with Google Calendar, Apple Calendar, Outlook, and more

**Recurring Events Support:**
- ✅ Daily recurring events (FREQ=DAILY)
- ✅ Weekly recurring events (FREQ=WEEKLY)
  - Supports BYDAY specification (e.g., MO,TU,WE,TH,FR)
  - Defaults to same day of week as DTSTART if BYDAY not specified
- ✅ Monthly recurring events (FREQ=MONTHLY, same day of month)
- ✅ Yearly recurring events (FREQ=YEARLY, same month and day)
- ✅ UNTIL end date support
- ✅ INTERVAL support for all frequencies
- ⚠️ COUNT parameter not yet supported
- ⚠️ Complex RRULE patterns (BYMONTHDAY, BYYEARDAY, etc.) not yet supported

**Event Display:**
- Shows only events occurring today
- Sorts events by start time
- Displays all-day events
- Shows event title, time, and description
- Auto-refreshes with the rest of the dashboard

## 🔮 Future Enhancements

Potential features for future versions:

- [ ] Advanced RRULE support (COUNT, BYMONTHDAY, etc.)
- [ ] Week view for calendar
- [ ] Event click to show full details
- [ ] Search and filter articles
- [ ] Mark articles as read/unread
- [ ] Favorite/bookmark articles
- [ ] Keyboard shortcuts
- [ ] Export articles to markdown
- [ ] AI-powered article summaries
- [ ] Multi-user support
- [ ] Email digest of daily briefing

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
