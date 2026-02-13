#!/usr/bin/env python3
"""
Briefing OPML Import Tool
Imports RSS feeds from an OPML file into feeds.json
"""

import xml.etree.ElementTree as ET
import json
import sys
import shutil
from pathlib import Path
from urllib.parse import urlparse


def parse_opml(file_path):
    """
    Parse OPML file and extract all RSS feeds

    Returns:
        list: List of dictionaries with 'name' and 'url' keys
    """
    feeds = []

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()

        # Find all outline elements
        for outline in root.iter('outline'):
            # Check if this is a feed (has type="rss" or xmlUrl attribute)
            feed_type = outline.get('type')
            xml_url = outline.get('xmlUrl')

            if feed_type == 'rss' or xml_url:
                # Extract feed URL (required)
                if not xml_url:
                    continue

                # Extract feed name (prefer text over title)
                name = outline.get('text') or outline.get('title')

                # If no name, derive from URL domain
                if not name:
                    parsed_url = urlparse(xml_url)
                    name = parsed_url.netloc or xml_url

                # Truncate very long names
                if len(name) > 50:
                    name = name[:47] + '...'

                feeds.append({
                    'name': name,
                    'url': xml_url.strip()
                })

        return feeds

    except ET.ParseError as e:
        print(f"❌ Error parsing OPML file: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"❌ OPML file not found: {file_path}")
        sys.exit(1)


def load_feeds_json():
    """
    Load current feeds.json configuration

    Returns:
        tuple: (feeds_list, settings_dict)
    """
    feeds_json_path = Path(__file__).parent / 'feeds.json'

    try:
        with open(feeds_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        feeds = data.get('feeds', [])
        settings = data.get('settings', {})

        return feeds, settings

    except FileNotFoundError:
        print(f"❌ feeds.json not found at: {feeds_json_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ Invalid JSON in feeds.json: {e}")
        sys.exit(1)


def normalize_url(url):
    """
    Normalize URL for comparison

    Args:
        url: URL string

    Returns:
        str: Normalized URL (lowercase, no trailing slash)
    """
    url = url.strip().lower()
    if url.endswith('/'):
        url = url[:-1]
    return url


def deduplicate_feeds(existing_feeds, new_feeds):
    """
    Filter out feeds that already exist

    Args:
        existing_feeds: List of existing feed dictionaries
        new_feeds: List of new feed dictionaries from OPML

    Returns:
        tuple: (unique_feeds, duplicates_list)
    """
    # Create set of normalized URLs from existing feeds
    existing_urls = {normalize_url(feed['url']) for feed in existing_feeds}

    unique_feeds = []
    duplicates = []

    for feed in new_feeds:
        normalized_url = normalize_url(feed['url'])

        if normalized_url not in existing_urls:
            unique_feeds.append(feed)
            existing_urls.add(normalized_url)  # Prevent duplicates within new_feeds too
        else:
            # Find the matching existing feed name
            matching_feed = next(
                (f for f in existing_feeds if normalize_url(f['url']) == normalized_url),
                None
            )
            duplicate_name = matching_feed['name'] if matching_feed else feed['name']
            duplicates.append(duplicate_name)

    return unique_feeds, duplicates


def merge_feeds(existing_feeds, new_feeds):
    """
    Merge existing and new feeds

    Args:
        existing_feeds: List of existing feed dictionaries
        new_feeds: List of new feed dictionaries

    Returns:
        list: Combined feed list
    """
    # Start with existing feeds (preserve their settings)
    merged = existing_feeds.copy()

    # Add new feeds with enabled: true
    for feed in new_feeds:
        merged.append({
            'name': feed['name'],
            'url': feed['url'],
            'enabled': True
        })

    # Sort new feeds alphabetically (keep existing at top)
    existing_count = len(existing_feeds)
    new_sorted = sorted(merged[existing_count:], key=lambda x: x['name'].lower())
    merged = merged[:existing_count] + new_sorted

    return merged


def save_feeds_json(feeds, settings):
    """
    Save updated feeds.json with backup

    Args:
        feeds: List of feed dictionaries
        settings: Settings dictionary
    """
    feeds_json_path = Path(__file__).parent / 'feeds.json'
    backup_path = Path(__file__).parent / 'feeds.json.backup'

    try:
        # Create backup
        shutil.copy2(feeds_json_path, backup_path)

        # Write updated feeds.json
        data = {
            'feeds': feeds,
            'settings': settings
        }

        with open(feeds_json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write('\n')  # Add trailing newline

    except IOError as e:
        print(f"❌ Error writing feeds.json: {e}")
        sys.exit(1)


def main():
    """Main execution flow"""

    # Check command line arguments
    if len(sys.argv) < 2:
        print("Usage: python3 import_opml.py <opml_file>")
        print("Example: python3 import_opml.py feedly.opml")
        sys.exit(1)

    opml_filename = sys.argv[1]
    opml_path = Path(__file__).parent / opml_filename

    # Print header
    print("=" * 60)
    print("🗞️  Briefing OPML Import Tool")
    print("=" * 60)

    # Parse OPML
    print(f"📂 Loading OPML: {opml_filename}")
    new_feeds = parse_opml(opml_path)
    print(f"✓ Parsed {len(new_feeds)} feeds from OPML")
    print()

    # Load existing feeds.json
    existing_feeds, settings = load_feeds_json()
    print(f"📋 Current feeds.json: {len(existing_feeds)} feeds")

    # Deduplicate
    print("🔍 Checking for duplicates...")
    unique_new_feeds, duplicates = deduplicate_feeds(existing_feeds, new_feeds)

    if duplicates:
        for dup in duplicates[:5]:  # Show first 5 duplicates
            print(f"  - Skipped: {dup} (already exists)")
        if len(duplicates) > 5:
            print(f"  - ... and {len(duplicates) - 5} more duplicates")
    else:
        print("  - No duplicates found")
    print()

    # Merge feeds
    if unique_new_feeds:
        print(f"✨ Adding {len(unique_new_feeds)} new feeds")
        merged_feeds = merge_feeds(existing_feeds, unique_new_feeds)

        # Save
        save_feeds_json(merged_feeds, settings)
        print(f"💾 Saved to feeds.json (backup: feeds.json.backup)")
    else:
        print("ℹ️  No new feeds to add")
        merged_feeds = existing_feeds

    # Summary
    print("=" * 60)
    print("📊 Summary:")
    print(f"  Total feeds now: {len(merged_feeds)}")
    print(f"  New feeds added: {len(unique_new_feeds)}")
    print(f"  Duplicates skipped: {len(duplicates)}")
    print(f"  Original feeds kept: {len(existing_feeds)}")
    print("=" * 60)
    print()

    if unique_new_feeds:
        print("💡 Next steps:")
        print("  1. Restart the Briefing server: python3 server.py")
        print("  2. Or refresh your browser to see new feeds")
        print("  3. Edit feeds.json to disable unwanted feeds")
        print()
        print(f"⚠️  Note: With {len(merged_feeds)} feeds, initial load may take 1-2 minutes")


if __name__ == '__main__':
    main()
