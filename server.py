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
        elif parsed_path.path == '/api/calendar':
            self.handle_api_calendar()
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

    def handle_api_calendar(self):
        """Fetch and aggregate all calendar events for today"""
        config = load_config()
        calendar_config = config.get('calendar', {})
        calendar_sources = calendar_config.get('sources', [])
        enabled_calendars = [c for c in calendar_sources if c.get('enabled', True)]
        cache_ttl = calendar_config.get('cacheTTL', 900)

        all_events = []
        errors = []

        for calendar in enabled_calendars:
            calendar_url = calendar.get('url')
            calendar_name = calendar.get('name', calendar_url)

            try:
                # Check cache
                if calendar_url in cache:
                    cached_data, expires_at = cache[calendar_url]
                    if datetime.now() < expires_at:
                        all_events.extend(cached_data)
                        continue

                # Fetch calendar
                events = self.fetch_calendar(calendar_url, calendar_name)

                # Update cache
                expires_at = datetime.now() + timedelta(seconds=cache_ttl)
                cache[calendar_url] = (events, expires_at)

                all_events.extend(events)
            except Exception as e:
                errors.append({'calendar': calendar_name, 'error': str(e)})
                print(f"Error fetching calendar {calendar_name}: {e}")

        # Sort by start time
        all_events.sort(key=lambda x: x.get('startTime', ''))

        # Send response
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = {
            'events': all_events,
            'errors': errors,
            'lastUpdated': datetime.now().isoformat()
        }
        self.wfile.write(json.dumps(response).encode())

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

    def fetch_calendar(self, calendar_url, calendar_name):
        """Fetch and parse an iCal calendar"""
        req = urllib.request.Request(
            calendar_url,
            headers={'User-Agent': 'Mozilla/5.0 (Briefing RSS Dashboard/1.0)'}
        )

        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
            ical_data = response.read().decode('utf-8')

        return self.parse_ical(ical_data, calendar_name)

    def parse_ical(self, ical_data, calendar_name):
        """Parse iCal format and extract today's events"""
        events = []

        # Get today's date range
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())

        # Split into lines for parsing
        lines = ical_data.split('\n')

        current_event = None
        current_field = None

        for line in lines:
            line = line.strip()

            # Handle line continuation
            if line.startswith(' ') or line.startswith('\t'):
                if current_field and current_event is not None:
                    current_event[current_field] += line.strip()
                continue

            if line == 'BEGIN:VEVENT':
                current_event = {}
            elif line == 'END:VEVENT':
                if current_event:
                    # Parse and add event if it's today
                    event = self.process_ical_event(current_event, calendar_name, today_start, today_end)
                    if event:
                        events.append(event)
                current_event = None
                current_field = None
            elif current_event is not None and ':' in line:
                # Parse field
                key, value = line.split(':', 1)
                # Handle parameters (e.g., DTSTART;TZID=... or DTSTART;VALUE=DATE)
                base_key = key.split(';')[0] if ';' in key else key

                current_field = base_key

                # Store the value under the base key
                if base_key not in current_event:
                    current_event[base_key] = value
                else:
                    # Append if already exists (for multi-line values)
                    current_event[base_key] += value

        return events

    def process_ical_event(self, event_data, calendar_name, today_start, today_end):
        """Process a single iCal event and return formatted event if it's today"""
        try:
            # Extract basic fields
            summary = event_data.get('SUMMARY', 'Untitled Event')
            description = event_data.get('DESCRIPTION', '')
            dtstart = event_data.get('DTSTART', '')
            dtend = event_data.get('DTEND', '')
            rrule = event_data.get('RRULE', '')

            # Parse start time
            start_dt = self.parse_ical_datetime(dtstart)
            if not start_dt:
                return None

            # Check if event is all-day (date only, no time component)
            is_all_day = 'T' not in dtstart

            # Handle recurring events
            if rrule:
                # Check if this recurring event occurs today
                if not self.check_rrule_occurrence(start_dt, rrule, today_start.date()):
                    return None

                # For recurring events, adjust the start/end time to today
                time_part = start_dt.time()
                start_dt = datetime.combine(today_start.date(), time_part)

                # Calculate end time if it exists
                if dtend:
                    original_end = self.parse_ical_datetime(dtend)
                    if original_end:
                        duration = original_end - self.parse_ical_datetime(event_data.get('DTSTART', ''))
                        end_dt = start_dt + duration
                    else:
                        end_dt = None
                else:
                    end_dt = None
            else:
                # Non-recurring event: check if it's today
                if is_all_day:
                    # All-day events: check if date matches
                    if start_dt.date() != today_start.date():
                        return None
                else:
                    # Timed events: check if starts today
                    if not (today_start <= start_dt <= today_end):
                        return None

                # Parse end time
                end_dt = self.parse_ical_datetime(dtend) if dtend else None

            # Clean up description (remove line breaks, limit length)
            description = description.replace('\\n', ' ').replace('\\,', ',').strip()

            return {
                'title': summary.replace('\\,', ',').replace('\\;', ';'),
                'startTime': start_dt.isoformat(),
                'endTime': end_dt.isoformat() if end_dt else start_dt.isoformat(),
                'description': description[:500],  # Limit description length
                'source': calendar_name,
                'isAllDay': is_all_day
            }
        except Exception as e:
            print(f"Error processing calendar event: {e}")
            return None

    def check_rrule_occurrence(self, start_dt, rrule, target_date):
        """Check if a recurring event occurs on the target date"""
        try:
            # Parse RRULE parameters
            rrule_params = {}
            for param in rrule.split(';'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    rrule_params[key] = value

            freq = rrule_params.get('FREQ', '').upper()

            # Check UNTIL date if present
            if 'UNTIL' in rrule_params:
                until_str = rrule_params['UNTIL']
                until_dt = self.parse_ical_datetime(until_str)
                if until_dt and target_date > until_dt.date():
                    return False

            # Check COUNT - we'll skip this for simplicity
            # (would need to count occurrences from start)

            # Get the day of week for the target date (0=Monday, 6=Sunday)
            target_weekday = target_date.weekday()

            # Map Python weekday to iCal BYDAY format
            # Python: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
            # iCal: MO, TU, WE, TH, FR, SA, SU
            weekday_map = {
                0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH',
                4: 'FR', 5: 'SA', 6: 'SU'
            }
            target_day_code = weekday_map[target_weekday]

            # Handle different frequencies
            if freq == 'DAILY':
                # Check interval (default is 1)
                interval = int(rrule_params.get('INTERVAL', '1'))
                days_diff = (target_date - start_dt.date()).days
                return days_diff >= 0 and days_diff % interval == 0

            elif freq == 'WEEKLY':
                # Check BYDAY if present
                if 'BYDAY' in rrule_params:
                    byday = rrule_params['BYDAY']
                    # BYDAY can be comma-separated: MO,TU,WE,TH,FR
                    allowed_days = byday.split(',')
                    if target_day_code not in allowed_days:
                        return False
                else:
                    # If BYDAY not specified, event recurs on the same day of week as DTSTART
                    start_day_code = weekday_map[start_dt.weekday()]
                    if target_day_code != start_day_code:
                        return False

                # Check interval (default is 1)
                interval = int(rrule_params.get('INTERVAL', '1'))
                weeks_diff = (target_date - start_dt.date()).days // 7
                return weeks_diff >= 0 and weeks_diff % interval == 0

            elif freq == 'MONTHLY':
                # Check if same day of month
                if start_dt.day == target_date.day:
                    # Check interval
                    interval = int(rrule_params.get('INTERVAL', '1'))
                    months_diff = (target_date.year - start_dt.year) * 12 + (target_date.month - start_dt.month)
                    return months_diff >= 0 and months_diff % interval == 0
                return False

            elif freq == 'YEARLY':
                # Check if same month and day
                if start_dt.month == target_date.month and start_dt.day == target_date.day:
                    interval = int(rrule_params.get('INTERVAL', '1'))
                    years_diff = target_date.year - start_dt.year
                    return years_diff >= 0 and years_diff % interval == 0
                return False

            # Unknown frequency - don't show
            return False

        except Exception as e:
            print(f"Error checking RRULE: {e}")
            return False

    def parse_ical_datetime(self, dt_string):
        """Parse iCal datetime string to Python datetime"""
        if not dt_string:
            return None

        try:
            # Remove trailing 'Z' if present (UTC indicator)
            dt_string = dt_string.rstrip('Z')

            # Check if it contains 'T' (datetime) or not (date only)
            if 'T' in dt_string:
                # DATE-TIME format: YYYYMMDDTHHMMSS
                return datetime.strptime(dt_string, '%Y%m%dT%H%M%S')
            else:
                # DATE format: YYYYMMDD
                return datetime.strptime(dt_string, '%Y%m%d')
        except Exception as e:
            print(f"Error parsing datetime '{dt_string}': {e}")
            return None

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
