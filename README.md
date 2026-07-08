# OLUTAJR ERP Project

## Folder Structure

- `html/`
  - `index.html` — main ERP frontend page
- `assets/`
  - `styles.css` — shared stylesheet extracted from the original page
  - `script.js` — frontend application logic extracted from the original page
- `python/`
  - `server.py` — starter Flask backend for serving the web app and a sample API

## How to run

1. Install Python dependencies:

```bash
pip install flask
```

2. Start the backend server:

```bash
python python/server.py
```

3. Open the browser at `http://127.0.0.1:5000`

## Notes

- The original combined file was moved to `html/ERP_backup.html` as a backup.
- The frontend still uses localStorage for persistence, but the Python backend stub can be extended to add real server-side login and data storage.
