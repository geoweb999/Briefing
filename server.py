#!/usr/bin/env python3
"""
Briefing RSS Dashboard Server
A simple RSS feed aggregator with a card-based web interface
"""

from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import ssl
import os
import re
from pathlib import Path

# Create SSL context that doesn't verify certificates (for development)
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# In-memory cache for feeds
cache = {}
CACHE_FILE = Path(__file__).parent / 'feeds.json'


def load_config():
    """Load feeds configuration from feeds.json"""
    try:
        with open(CACHE_FILE, 'r') as f:
            config = json.load(f)
            return config
    except Exception as e:
        print(f"Error loading feeds.json: {e}")
        return {"feeds": [], "settings": {"cacheTTL": 900, "maxItemsPerFeed": 20, "port": 3001}}


def strip_html(text):
    """Remove HTML tags from text"""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities
    clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
    clean = clean.replace('&quot;', '"').replace('&#39;', "'")
    # Trim whitespace
    return clean.strip()


def extract_image_from_description(description):
    """Try to extract an image URL from HTML description"""
    if not description:
        return None
    # Look for img tags
    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', description)
    if img_match:
        return img_match.group(1)
    return None


class RSSHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)

        # API endpoint to fetch RSS feeds
        if parsed_path.path == '/api/feeds':
            self.handle_api_feeds()
        elif parsed_path.path == '/api/config':
            self.handle_api_config()
        else:
            # Serve static files from public directory
            self.path = '/public' + self.path
            if self.path.endswith('/'):
                self.path += 'index.html'
            super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)

        if parsed_path.path == '/api/refresh':
            self.handle_api_refresh()
        elif parsed_path.path == '/api/save-config':
            self.handle_api_save_config()
        else:
            self.send_error(404)

    def handle_api_feeds(self):
        """Fetch and aggregate all RSS feeds"""
        config = load_config()
        enabled_feeds = [f for f in config.get('feeds', []) if f.get('enabled', True)]
        max_items = config.get('settings', {}).get('maxItemsPerFeed', 20)
        cache_ttl = config.get('settings', {}).get('cacheTTL', 900)

        all_articles = []
        errors = []

        for feed in enabled_feeds:
            feed_url = feed.get('url')
            feed_name = feed.get('name', feed_url)
            feed_category = feed.get('category', 'Uncategorized')

            try:
                # Check cache
                if feed_url in cache:
                    cached_data, expires_at = cache[feed_url]
                    if datetime.now() < expires_at:
                        all_articles.extend(cached_data)
                        continue

                # Fetch feed
                articles = self.fetch_feed(feed_url, feed_name, feed_category, max_items)

                # Update cache
                expires_at = datetime.now() + timedelta(seconds=cache_ttl)
                cache[feed_url] = (articles, expires_at)

                all_articles.extend(articles)
            except Exception as e:
                errors.append({'feed': feed_name, 'error': str(e)})
                print(f"Error fetching {feed_name}: {e}")

        # Sort by date (newest first)
        all_articles.sort(key=lambda x: x.get('pubDate', ''), reverse=True)

        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            'articles': all_articles,
            'errors': errors,
            'lastUpdated': datetime.now().isoformat()
        }
        self.wfile.write(json.dumps(response).encode())

    def handle_api_config(self):
        """Return current feed configuration"""
        config = load_config()

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps(config).encode())

    def handle_api_refresh(self):
        """Clear cache and refetch feeds"""
        global cache
        cache = {}

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps({'status': 'cache cleared'}).encode())

    def handle_api_save_config(self):
        """Save feeds configuration to feeds.json"""
        try:
            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            config = json.loads(post_data.decode('utf-8'))

            # Create backup
            backup_path = CACHE_FILE.parent / 'feeds.json.backup'
            if CACHE_FILE.exists():
                import shutil
                shutil.copy2(CACHE_FILE, backup_path)

            # Write new config
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
                f.write('\n')

            # Clear cache to reload new config
            global cache
            cache = {}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            self.wfile.write(json.dumps({'status': 'success', 'message': 'Configuration saved'}).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            self.wfile.write(json.dumps({'status': 'error', 'message': str(e)}).encode())

    def fetch_feed(self, feed_url, feed_name, feed_category, max_items):
        """Fetch and parse an RSS feed"""
        req = urllib.request.Request(
            feed_url,
            headers={'User-Agent': 'Mozilla/5.0 (Briefing RSS Dashboard/1.0)'}
        )

        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
            xml_data = response.read()

        return self.parse_rss(xml_data, feed_name, feed_category, feed_url, max_items)

    def parse_rss(self, xml_data, feed_name, feed_category, source_url, max_items):
        """Parse RSS/Atom feed XML"""
        try:
            root = ET.fromstring(xml_data)

            # Check if it's Atom or RSS
            if root.tag == '{http://www.w3.org/2005/Atom}feed':
                return self.parse_atom(root, feed_name, feed_category, source_url, max_items)
            else:
                return self.parse_rss_xml(root, feed_name, feed_category, source_url, max_items)
        except Exception as e:
            print(f"Error parsing feed {source_url}: {e}")
            return []

    def parse_rss_xml(self, root, feed_name, feed_category, source_url, max_items):
        """Parse RSS 2.0 format"""
        articles = []
        channel = root.find('channel')

        if channel is None:
            return articles

        for item in channel.findall('item')[:max_items]:
            title = item.find('title')
            link = item.find('link')
            description = item.find('description')
            pub_date = item.find('pubDate')

            # Try to find an image
            image_url = None

            # Check for media:content
            media_content = item.find('{http://search.yahoo.com/mrss/}content')
            if media_content is not None:
                image_url = media_content.get('url')

            # Check for media:thumbnail
            if not image_url:
                media_thumbnail = item.find('{http://search.yahoo.com/mrss/}thumbnail')
                if media_thumbnail is not None:
                    image_url = media_thumbnail.get('url')

            # Check for enclosure
            if not image_url:
                enclosure = item.find('enclosure')
                if enclosure is not None and 'image' in enclosure.get('type', ''):
                    image_url = enclosure.get('url')

            # Try to extract image from description
            desc_text = description.text if description is not None else ''
            if not image_url and desc_text:
                image_url = extract_image_from_description(desc_text)

            articles.append({
                'title': title.text if title is not None and title.text else 'No title',
                'link': link.text if link is not None and link.text else '',
                'description': strip_html(desc_text)[:300],  # Limit to 300 chars
                'pubDate': pub_date.text if pub_date is not None else '',
                'source': feed_name,
                'sourceUrl': source_url,
                'image': image_url,
                'category': feed_category
            })

        return articles

    def parse_atom(self, root, feed_name, feed_category, source_url, max_items):
        """Parse Atom format"""
        articles = []
        ns = {'atom': 'http://www.w3.org/2005/Atom'}

        for entry in root.findall('atom:entry', ns)[:max_items]:
            title = entry.find('atom:title', ns)
            link = entry.find('atom:link', ns)
            content = entry.find('atom:content', ns)
            summary = entry.find('atom:summary', ns)
            updated = entry.find('atom:updated', ns)

            # Get description
            description = ''
            if content is not None:
                description = content.text or ''
            elif summary is not None:
                description = summary.text or ''

            # Try to find image
            image_url = None
            if description:
                image_url = extract_image_from_description(description)

            articles.append({
                'title': title.text if title is not None and title.text else 'No title',
                'link': link.get('href') if link is not None else '',
                'description': strip_html(description)[:300],
                'pubDate': updated.text if updated is not None else '',
                'source': feed_name,
                'sourceUrl': source_url,
                'image': image_url,
                'category': feed_category
            })

        return articles

    def log_message(self, format, *args):
        """Custom log format"""
        # Only log errors, not every request
        if '404' in str(args) or '500' in str(args):
            super().log_message(format, *args)


def run_server():
    """Start the HTTP server"""
    config = load_config()
    port = config.get('settings', {}).get('port', 3001)

    server_address = ('', port)
    httpd = HTTPServer(server_address, RSSHandler)

    print("=" * 60)
    print("🗞️  Briefing RSS Dashboard")
    print("=" * 60)
    print(f"🚀 Server running at http://localhost:{port}")
    print(f"📡 Open your browser and visit the URL above")
    print(f"⚙️  Configuration: {CACHE_FILE}")
    print(f"📰 Active feeds: {len([f for f in config.get('feeds', []) if f.get('enabled', True)])}")
    print("=" * 60)
    print("Press Ctrl+C to stop the server")
    print()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down server...")
        httpd.shutdown()


if __name__ == '__main__':
    run_server()
