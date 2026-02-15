#!/usr/bin/env python3
"""
Email Shipment Tracker (IMAP)
Uses IMAP to read shipping notifications from any email provider
No API registration required - just email and password
"""

import imaplib
import email
from email.header import decode_header
import re
import json
from datetime import datetime, timedelta
import sys

class EmailShipmentTracker:
    def __init__(self, email_address, password, imap_server, imap_port=993):
        self.email_address = email_address
        self.password = password
        self.imap_server = imap_server
        self.imap_port = imap_port
        self.mail = None

    def connect(self):
        """Connect to IMAP server"""
        try:
            self.mail = imaplib.IMAP4_SSL(self.imap_server, self.imap_port)
            self.mail.login(self.email_address, self.password)
            print(f"✓ Connected to {self.imap_server}")
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            print("\nTroubleshooting:")
            print("- For Outlook: Use 'outlook.office365.com' or enable app passwords")
            print("- For Gmail: Enable 'Less secure app access' or use app password")
            print("- Check your email address and password")
            return False

    def search_shipping_emails(self, days_back=14):
        """Search for shipping-related emails"""
        try:
            self.mail.select('INBOX')

            # Search date
            date = (datetime.now() - timedelta(days=days_back)).strftime("%d-%b-%Y")

            # Search for shipping keywords
            keywords = ['shipped', 'shipping', 'tracking', 'delivery', 'package', 'order', 'ready']

            email_ids = []
            for keyword in keywords:
                _, data = self.mail.search(None, f'(SINCE {date} SUBJECT "{keyword}")')
                email_ids.extend(data[0].split())

            # Remove duplicates
            email_ids = list(set(email_ids))

            print(f"✓ Found {len(email_ids)} shipping-related emails\n")

            return email_ids
        except Exception as e:
            print(f"✗ Search error: {e}")
            return []

    def fetch_email(self, email_id):
        """Fetch and parse a single email"""
        try:
            _, data = self.mail.fetch(email_id, '(RFC822)')
            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            # Get subject
            subject = self.decode_subject(msg['Subject'])

            # Get from
            from_addr = msg['From']

            # Get date
            date_str = msg['Date']

            # Get body
            body = self.get_email_body(msg)

            return {
                'subject': subject,
                'from': from_addr,
                'date': date_str,
                'body': body
            }
        except Exception as e:
            print(f"Error fetching email: {e}")
            return None

    def decode_subject(self, subject):
        """Decode email subject"""
        if subject is None:
            return "No Subject"

        decoded = decode_header(subject)
        subject_parts = []

        for part, encoding in decoded:
            if isinstance(part, bytes):
                subject_parts.append(part.decode(encoding or 'utf-8', errors='ignore'))
            else:
                subject_parts.append(part)

        return ''.join(subject_parts)

    def get_email_body(self, msg):
        """Extract email body"""
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    try:
                        body += part.get_payload(decode=True).decode('utf-8', errors='ignore')
                    except:
                        pass
        else:
            try:
                body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            except:
                body = str(msg.get_payload())

        return body

    def extract_tracking_info(self, emails):
        """Extract tracking numbers and delivery info"""
        shipments = []

        # Tracking patterns
        tracking_patterns = {
            'UPS': r'\b(1Z[0-9A-Z]{16})\b',
            'FedEx': r'\b(\d{12,14}|\d{20,22})\b',
            'USPS': r'\b(9[0-9]{15,21}|[0-9]{20,22})\b',
            'Amazon': r'\b(TBA\d{12})\b'
        }

        # Delivery date patterns
        date_patterns = [
            r'arriving\s+(?:on\s+)?([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})',
            r'delivery\s+date:?\s*([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})',
            r'estimated\s+delivery:?\s*([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})',
            r'will\s+arrive\s+(?:by\s+)?([A-Za-z]+,?\s+[A-Za-z]+\s+\d{1,2})'
        ]

        for email_data in emails:
            if not email_data:
                continue

            shipment = {
                'subject': email_data['subject'],
                'from': email_data['from'],
                'date': email_data['date'],
                'tracking_numbers': [],
                'delivery_date': None,
                'courier': 'Unknown'
            }

            # Search in subject and body
            search_text = email_data['subject'] + ' ' + email_data['body']

            # Extract tracking numbers
            for courier, pattern in tracking_patterns.items():
                matches = re.findall(pattern, search_text)
                if matches:
                    shipment['tracking_numbers'].extend(matches[:3])  # Limit to 3
                    shipment['courier'] = courier

            # Extract delivery date
            for pattern in date_patterns:
                match = re.search(pattern, search_text, re.IGNORECASE)
                if match:
                    shipment['delivery_date'] = match.group(1)
                    break

            # Only include if relevant
            if shipment['tracking_numbers'] or shipment['delivery_date'] or self.is_shipping_email(email_data):
                shipments.append(shipment)

        return shipments

    def is_shipping_email(self, email_data):
        """Check if email is shipping-related"""
        text = (email_data['subject'] + ' ' + email_data['from']).lower()

        keywords = ['shipped', 'tracking', 'delivery', 'package', 'order']
        domains = ['amazon', 'fedex', 'ups', 'usps', 'shopify', 'etsy']

        for keyword in keywords:
            if keyword in text:
                return True

        for domain in domains:
            if domain in text:
                return True

        return False

    def filter_upcoming_deliveries(self, shipments):
        """Filter for deliveries in the next 7 days"""
        today = datetime.now()

        # Create list of date strings for the next 7 days
        upcoming_dates = []
        for i in range(7):
            date = today + timedelta(days=i)
            date_str = date.strftime('%A, %B %d').replace(' 0', ' ')
            upcoming_dates.append(date_str.lower())

        upcoming_shipments = []

        for shipment in shipments:
            delivery = shipment.get('delivery_date', '') or ''
            delivery = delivery.lower()
            if not delivery:
                continue

            # Check if delivery date matches any of the next 7 days or contains "today"
            if 'today' in delivery:
                upcoming_shipments.append(shipment)
            else:
                for date_str in upcoming_dates:
                    if date_str in delivery:
                        upcoming_shipments.append(shipment)
                        break

        return upcoming_shipments

    def disconnect(self):
        """Close IMAP connection"""
        if self.mail:
            self.mail.close()
            self.mail.logout()

def main():
    """Main function"""
    print("="*60)
    print("Email Shipment Tracker (IMAP)")
    print("="*60)

    # IMAP server configurations
    servers = {
        'outlook': 'outlook.office365.com',
        'gmail': 'imap.gmail.com',
        'yahoo': 'imap.mail.yahoo.com',
        'icloud': 'imap.mail.me.com'
    }

    if len(sys.argv) < 3:
        print("\nUsage: python3 email_shipments_imap.py <email> <password> [provider]")
        print("\nProvider options: outlook (default), gmail, yahoo, icloud")
        print("\nExample: python3 email_shipments_imap.py you@outlook.com yourpassword outlook")
        print("\nSecurity Note:")
        print("- For Outlook: May need to enable 'app passwords' in account settings")
        print("- For Gmail: Enable 'Less secure apps' or create app-specific password")
        print("- Store credentials securely, don't share your password")
        return

    email_addr = sys.argv[1]
    password = sys.argv[2]
    provider = sys.argv[3] if len(sys.argv) > 3 else 'outlook'

    # Detect provider from email if not specified
    if '@outlook.com' in email_addr or '@hotmail.com' in email_addr:
        provider = 'outlook'
    elif '@gmail.com' in email_addr:
        provider = 'gmail'
    elif '@yahoo.com' in email_addr:
        provider = 'yahoo'
    elif '@icloud.com' in email_addr or '@me.com' in email_addr:
        provider = 'icloud'

    imap_server = servers.get(provider, 'outlook.office365.com')

    print(f"\nConnecting to: {email_addr}")
    print(f"IMAP Server: {imap_server}\n")

    tracker = EmailShipmentTracker(email_addr, password, imap_server)

    if not tracker.connect():
        sys.exit(1)

    # Search for emails
    print("Searching for shipping emails...\n")
    email_ids = tracker.search_shipping_emails(days_back=14)

    # Fetch emails
    emails = []
    for i, email_id in enumerate(email_ids[:50]):  # Limit to 50
        if i % 10 == 0:
            print(f"Processing email {i+1}/{min(len(email_ids), 50)}...")
        email_data = tracker.fetch_email(email_id)
        if email_data:
            emails.append(email_data)

    # Extract tracking info
    print("\nExtracting tracking information...\n")
    shipments = tracker.extract_tracking_info(emails)

    # Filter upcoming deliveries (next 7 days)
    upcoming_shipments = tracker.filter_upcoming_deliveries(shipments)

    print(f"\n📦 Total shipments found: {len(shipments)}")
    print(f"📅 Arriving in next 7 days: {len(upcoming_shipments)}\n")

    # Display upcoming deliveries
    if upcoming_shipments:
        print("="*60)
        print("DELIVERIES IN NEXT 7 DAYS")
        print("="*60)
        for shipment in upcoming_shipments:
            print(f"\n📦 {shipment['subject']}")
            print(f"   From: {shipment['from'][:50]}...")
            print(f"   Courier: {shipment['courier']}")
            if shipment['tracking_numbers']:
                print(f"   Tracking: {', '.join(shipment['tracking_numbers'][:2])}")
            print(f"   Delivery: {shipment['delivery_date']}")

    # Save to JSON
    output = {
        'timestamp': datetime.now().isoformat(),
        'email': email_addr,
        'total_shipments': len(shipments),
        'upcoming_count': len(upcoming_shipments),
        'deliveries': upcoming_shipments,
        'all_shipments': shipments
    }

    output_file = 'data/shipments.json'
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n✓ Saved to {output_file}")

    tracker.disconnect()
    print("\n✓ Done!")

if __name__ == '__main__':
    main()
