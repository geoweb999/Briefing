# Package Tracking for Briefing

## The Problem

Microsoft Outlook.com has disabled basic authentication (IMAP with username/password) as of September 2024. This means we cannot automatically read your emails to detect shipping notifications using IMAP, even with app-specific passwords.

## The Solution: Manual Package Tracker

I've created a simple web interface where you can manually add packages you're expecting today. This takes less than 30 seconds and gives you a clean view of your deliveries.

## How to Use

### 1. Access the Package Tracker

Open your browser and go to:
```
http://localhost:3001/packages.html
```

### 2. Add a Package

Fill out the form with:
- **Package Name**: Brief description (e.g., "Amazon - Office Supplies")
- **Courier**: Select from dropdown (Amazon, UPS, FedEx, USPS, DHL, Other)
- **Tracking Number**: Optional, but helpful if you have it
- **Delivery Time**: Optional estimated time window (e.g., "2:00 PM - 5:00 PM")

Click "Add Package" and it will appear in the list below.

### 3. View Today's Deliveries

All packages you've added will be displayed in the "Today's Deliveries" section.

### 4. Delete When Delivered

Once a package arrives, click the "Delete" button next to it.

### 5. Automatic Daily Reset

The package list automatically clears at midnight each day, so you start fresh every morning.

## Data Storage

- **Browser**: Packages are stored in your browser's localStorage
- **Server**: Packages are also saved to `data/shipments_manual.json` for potential integration with the main dashboard

## Next Steps (Optional)

If you want automatic email tracking instead of manual entry, you have two options:

### Option 1: Use Gmail Instead
1. Forward shipping notifications to a Gmail account
2. Enable 2-factor authentication on Gmail
3. Generate an app-specific password
4. Use the `email_shipments_imap.py` script with Gmail's IMAP

### Option 2: Microsoft Graph API with Azure
1. Get access to Azure App Registration (requires Microsoft account admin access)
2. Follow the setup in `OUTLOOK_SETUP.md`
3. Use the `outlook_shipments.py` script

## Files

- `public/packages.html` - Manual package tracking interface
- `data/shipments_manual.json` - Saved package data
- `server.py` - Includes `/api/save-packages` endpoint

## Quick Start

```bash
# Server should already be running
# If not, start it:
python3 server.py

# Open in browser:
open http://localhost:3001/packages.html
```

## Tips

- Add packages in the morning when you check your email
- Include tracking numbers for easy reference
- Use the delivery time field if your shipper provides a window
- The interface works on mobile too!
